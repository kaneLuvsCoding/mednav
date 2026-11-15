"""Fixture validation and real-component contracts. No substitute decision engine."""
import copy
import csv
import importlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from contextlib import contextmanager
from datetime import datetime
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[2]
SCENARIOS=json.loads((ROOT/'data/scenarios/scenarios.json').read_text())
CONTEXT=json.loads((ROOT/'data/scenarios/context.json').read_text())
NUMERIC={'resting_hr_bpm','sleep_hours','systolic_bp_mm_hg','diastolic_bp_mm_hg'}
REQUIRED={'astronaut_id','observed_at','symptoms','measurements','personal_baseline','available_equipment','communication_status','emergency_override','dataset_type'}

def valid_request(r):
    assert set(r)==REQUIRED
    assert r['astronaut_id'] in {'A01','A02','A03','A04'}
    assert datetime.fromisoformat(r['observed_at']).tzinfo is not None
    assert r['dataset_type']=='synthetic'
    assert type(r['emergency_override']) is bool
    assert r['communication_status'] in {'online','offline'}
    for key in ('symptoms','available_equipment'):
        assert isinstance(r[key],list) and all(isinstance(v,str) for v in r[key])
    assert set(r['measurements'])==NUMERIC
    assert all(v is None or type(v) in (int,float) for v in r['measurements'].values())
    assert set(r['personal_baseline'])=={'resting_hr_bpm','sleep_hours'}
    assert all(type(v) in (int,float) for v in r['personal_baseline'].values())

def assert_response(case, out):
    """Invariants from API v1, not invented medical expectations."""
    required={'status','observations','missing_data','resource_constraints','safety_flags','next_check','requires_medical_officer_review','explanation','evidence_sources','diagnosis'}
    assert isinstance(out,dict) and required <= set(out), 'response shape'
    assert isinstance(out['status'],str) and out['status'], 'status'
    for key in ('observations','missing_data','resource_constraints','safety_flags','evidence_sources'):
        assert isinstance(out[key],list) and all(isinstance(x,str) for x in out[key]), key
    assert type(out['requires_medical_officer_review']) is bool
    assert isinstance(out['explanation'],str) and out['explanation'].strip()
    assert out['diagnosis'] is None, 'diagnosis must remain null'
    assert set(case['expected_missing_data']) <= set(out['missing_data']), 'missing measurement lost'
    assert any(s.startswith('synthetic:') for s in out['evidence_sources']), 'synthetic provenance missing'
    req=case['investigation_request']
    nxt=out['next_check']
    if nxt is not None:
        assert isinstance(nxt,dict) and {'id','label','requires_equipment','prototype_only'} <= set(nxt)
        assert isinstance(nxt['requires_equipment'],list)
        assert nxt['prototype_only'] is True
        needed=set(nxt['requires_equipment'])
        assert needed <= set(req['available_equipment']), 'unavailable equipment selected'
        assert not needed.intersection(case['forbidden_equipment']), 'forbidden equipment'
        if 'bp_monitor' not in req['available_equipment']:
            assert nxt['id']!='measure_blood_pressure', 'BP check hides equipment dependency'
    if case['expected_status'] is not None:
        assert out['status']==case['expected_status'], 'expected status'
    if req['emergency_override']:
        assert out['status']=='escalate' and nxt is None, 'override did not bypass ranking'
        assert out['requires_medical_officer_review'] is True
        assert 'approved_emergency_protocol_required' in out['safety_flags']
    if case['scenario_id']=='S12':
        assert nxt is None

def load_callable(env):
    target=os.getenv(env)
    if not target:
        raise unittest.SkipTest(f'{env} not configured: real component absent')
    module, name=target.split(':',1)
    return getattr(importlib.import_module(module),name)

@contextmanager
def no_network():
    """Block Python socket access, including during component import; not an OS sandbox."""
    def blocked(*a,**kw):
        raise AssertionError('Network attempted during offline engine evaluation')
    with patch.object(socket.socket,'connect',blocked), patch.object(socket.socket,'connect_ex',blocked), patch.object(socket.socket,'sendto',blocked), patch.object(socket,'getaddrinfo',blocked), patch.object(socket,'create_connection',blocked):
        yield

def rows(name):
    with (ROOT/'data/synthetic'/name).open(newline='') as stream:
        return list(csv.DictReader(stream))

class SeedTests(unittest.TestCase):
    def test_four_fictional_profiles(self):
        crew=rows('astronauts.csv')
        self.assertEqual({r['astronaut_id'] for r in crew},{'A01','A02','A03','A04'})
        self.assertEqual(len(crew),4)
        self.assertTrue(all(r['display_name'].startswith('Crew ') for r in crew))
    def test_thirty_unique_days_each(self):
        health=rows('health_daily.csv')
        self.assertEqual(len(health),120)
        for id_ in ('A01','A02','A03','A04'):
            dates=[r['observed_at'] for r in health if r['astronaut_id']==id_]
            self.assertEqual(len(set(dates)),30)
            self.assertTrue(all(datetime.fromisoformat(d).tzinfo for d in dates))
            self.assertEqual((datetime.fromisoformat(max(dates))-datetime.fromisoformat(min(dates))).days,29)
        for r in health:
            self.assertIsInstance(json.loads(r['reported_symptoms']),list)
    def test_synthetic_labels(self):
        for name in ('astronauts.csv','health_daily.csv','inventory.csv'):
            self.assertTrue(all(r['dataset_type']=='synthetic' for r in rows(name)))
    def test_outage_is_unknown_not_zero(self):
        outage=[r for r in rows('health_daily.csv') if r['astronaut_id']=='A03' and r['observed_at'].startswith('2026-10-30')]
        self.assertEqual(len(outage),1)
        self.assertEqual(outage[0]['resting_hr_bpm'],'')
        self.assertEqual(outage[0]['sleep_hours'],'')
    def test_inventory_types_and_default_availability(self):
        inv=rows('inventory.csv')
        self.assertEqual(len({r['equipment_id'] for r in inv}),len(inv))
        for r in inv:
            self.assertIn(r['usable'],('true','false'))
            self.assertGreaterEqual(int(r['quantity']),0)
        available=sorted(r['equipment_id'] for r in inv if int(r['quantity'])>0 and r['usable']=='true')
        self.assertEqual(available,sorted(SCENARIOS[0]['investigation_request']['available_equipment']))
    def test_inventory_context_matches_requests(self):
        for case in SCENARIOS:
            context=CONTEXT.get(case['scenario_id'],{})
            if 'inventory' in context:
                available={r['equipment_id'] for r in context['inventory'] if r['quantity']>0 and r['usable']}
                self.assertEqual(available,set(case['investigation_request']['available_equipment']))
    def test_generator_byte_reproducibility(self):
        spec=importlib.util.spec_from_file_location('seed_generator',ROOT/'data/generate_seed.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as temp:
            module.generate(Path(temp))
            for p in Path(temp).rglob('*'):
                if p.is_file():
                    self.assertEqual(p.read_bytes(),(ROOT/'data'/p.relative_to(temp)).read_bytes(),str(p))
    def test_scenario_coverage_and_null_expectations(self):
        self.assertGreaterEqual(len(SCENARIOS),12)
        self.assertEqual(len({s['scenario_id'] for s in SCENARIOS}),len(SCENARIOS))
        for s in SCENARIOS:
            self.assertEqual(set(s['expected_missing_data']),{k for k,v in s['investigation_request']['measurements'].items() if v is None})
    def test_valid_request_shapes(self):
        for case in SCENARIOS:
            if case['scenario_id']!='S13':
                with self.subTest(case=case['scenario_id']): valid_request(case['investigation_request'])
    def test_intentionally_invalid_fixture(self):
        with self.assertRaises(AssertionError): valid_request(SCENARIOS[12]['investigation_request'])
    def test_offline_guard_rejects_network_attempt(self):
        with no_network(), self.assertRaises(AssertionError):
            socket.create_connection(('example.com',443))
    def test_oracle_catches_unsafe_responses(self):
        # Test-only oracle input, not a production engine or demo output.
        case=SCENARIOS[3]
        out=dict(status='needs_review',observations=[],missing_data=case['expected_missing_data'],resource_constraints=[],safety_flags=[],next_check=None,requires_medical_officer_review=True,explanation='Unknown.',evidence_sources=['synthetic:oracle-test'],diagnosis=None)
        assert_response(case,out)
        mutations=[{'missing_data':[]},{'diagnosis':'invented'},{'evidence_sources':[]},{'next_check':{'id':'measure_blood_pressure','label':'Test','requires_equipment':['bp_monitor'],'prototype_only':True}}]
        for mutation in mutations:
            with self.assertRaises(AssertionError): assert_response(case,{**out,**mutation})
        with self.assertRaises(AssertionError): assert_response(SCENARIOS[9],out)

class EngineTests(unittest.TestCase):
    def test_determinism_and_input_immutability(self):
        evaluate=load_callable('MEDNAV_EVALUATOR')
        for case in SCENARIOS:
            if case['scenario_id'] in ('S06','S12','S13'): continue
            with self.subTest(case=case['scenario_id']):
                req=copy.deepcopy(case['investigation_request']); original=copy.deepcopy(req)
                first=evaluate(req)
                self.assertEqual(req,original)
                second=evaluate(copy.deepcopy(original))
                self.assertEqual(first,second)
                assert_response(case,first)
    def test_offline_engine_import_and_execution(self):
        if not os.getenv('MEDNAV_EVALUATOR'):
            self.skipTest('MEDNAV_EVALUATOR not configured: real component absent')
        # A fresh interpreter ensures engine imports cannot rely on an earlier cached import.
        script = "from test_member4 import *\nwith no_network():\n evaluate=load_callable('MEDNAV_EVALUATOR')\n case=SCENARIOS[8]\n assert_response(case,evaluate(copy.deepcopy(case['investigation_request'])))"
        env=dict(os.environ)
        env['PYTHONPATH']=os.pathsep.join([str(ROOT),str(Path(__file__).parent),env.get('PYTHONPATH','')])
        completed=subprocess.run([sys.executable,'-c',script],cwd=ROOT,env=env,capture_output=True,text=True,timeout=30)
        self.assertEqual(completed.returncode,0,completed.stdout+completed.stderr)
    def test_empty_catalog(self):
        evaluate=load_callable('MEDNAV_CONTEXT_EVALUATOR')
        case=SCENARIOS[11]
        assert_response(case,evaluate(copy.deepcopy(case['investigation_request']),copy.deepcopy(CONTEXT['S12'])))
    def test_conflicting_records(self):
        self.skipTest('API v1 conflict representation and expected response not agreed; see handoff')

def make_engine_test(case):
    def test(self):
        evaluate=load_callable('MEDNAV_EVALUATOR')
        assert_response(case,evaluate(copy.deepcopy(case['investigation_request'])))
    return test
for case in SCENARIOS:
    if case['scenario_id'] not in ('S06','S12','S13'):
        setattr(EngineTests,'test_'+case['scenario_id'],make_engine_test(case))

class ApiTests(unittest.TestCase):
    def post(self,request):
        base=os.getenv('MEDNAV_API_URL')
        if not base: self.skipTest('MEDNAV_API_URL not configured: local backend absent')
        parsed=urlparse(base)
        self.assertIn(parsed.hostname,('localhost','127.0.0.1','::1'),'Use a local test server')
        self.assertEqual(parsed.scheme,'http')
        req=Request(base.rstrip('/')+'/api/v1/investigations',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'})
        try:
            with urlopen(req,timeout=10) as response: return response.status,json.load(response)
        except HTTPError as error: return error.code,json.load(error)
    def test_invalid_type_returns_actionable_error(self):
        code,body=self.post(SCENARIOS[12]['investigation_request'])
        self.assertIn(code,(400,422))
        self.assertEqual(body['error']['code'],'validation_error')
        self.assertTrue(body['error']['message'].strip())
    def test_valid_scenarios(self):
        if not os.getenv('MEDNAV_API_URL'): self.skipTest('MEDNAV_API_URL not configured: local backend absent')
        for case in SCENARIOS:
            if case['scenario_id'] in ('S03','S06','S08','S12','S13'): continue
            with self.subTest(case=case['scenario_id']):
                code,body=self.post(case['investigation_request'])
                self.assertIn(code,(200,201)); assert_response(case,body)
    def test_inventory_sanitization(self):
        # Member 2 adapter must seed a disposable DB and invoke the REAL API path.
        evaluate=load_callable('MEDNAV_INVENTORY_API_EVALUATOR')
        for id_ in ('S03','S04','S08'):
            case=next(c for c in SCENARIOS if c['scenario_id']==id_)
            req=copy.deepcopy(case['investigation_request'])
            req['available_equipment']=['bp_monitor','thermometer','pulse_oximeter','weighing_scale']
            code,out=evaluate(req,copy.deepcopy(CONTEXT[id_]['inventory']))
            self.assertIn(code,(200,201))
            assert_response(case,out)

if __name__=='__main__': unittest.main()
