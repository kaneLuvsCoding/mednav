"""Deterministic, standard-library-only fictional fixtures; never a clinical model."""
import csv
import json
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = 'member4-seed-v1'

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)

def generate(root=ROOT):
    crew = [dict(astronaut_id=f'A{i+1:02}', display_name=f'Crew {chr(65+i)}', dataset_type='synthetic') for i in range(4)]
    write_csv(root/'synthetic/astronauts.csv', list(crew[0]), crew)
    start = datetime(2026, 10, 16, 9, tzinfo=timezone(timedelta(hours=6, minutes=30)))
    health = []
    for i, person in enumerate(crew):
        for day in range(30):
            symptoms = ['fatigue'] if i == 1 and day >= 25 else []
            hr = 68 + i*2 + ((day*3+i) % 7)-3
            sleep = round(7.5-i*0.1+((day+i)%5-2)*0.2-(1.5 if symptoms else 0), 1)
            if i == 2 and day == 14:
                hr = sleep = None
            health.append(dict(astronaut_id=person['astronaut_id'], observed_at=(start+timedelta(days=day)).isoformat(), resting_hr_bpm=hr, sleep_hours=sleep, reported_symptoms=json.dumps(symptoms), dataset_type='synthetic'))
    write_csv(root/'synthetic/health_daily.csv', list(health[0]), health)
    inventory = [dict(equipment_id=id_, label=label, quantity=qty, usable=usable, dataset_type='synthetic') for id_,label,qty,usable in [
        ('thermometer','Thermometer',1,True), ('bp_monitor','Blood-pressure monitor',0,False),
        ('pulse_oximeter','Pulse oximeter',1,False), ('weighing_scale','Weighing scale',1,True)]]
    csv_inventory = [{**r, 'usable': str(r['usable']).lower()} for r in inventory]
    write_csv(root/'synthetic/inventory.csv', list(csv_inventory[0]), csv_inventory)
    base = dict(astronaut_id='A01', observed_at='2026-11-14T09:00:00+06:30', symptoms=[], measurements=dict(resting_hr_bpm=70,sleep_hours=7.3,systolic_bp_mm_hg=118,diastolic_bp_mm_hg=76), personal_baseline=dict(resting_hr_bpm=70,sleep_hours=7.3), available_equipment=['thermometer','weighing_scale'], communication_status='offline', emergency_override=False, dataset_type='synthetic')
    scenarios=[]
    def add(id_, title, *, measurement=None, changes=None, status=None, note='', context=None):
        request=deepcopy(base)
        request.update(changes or {})
        request['measurements'].update(measurement or {})
        scenarios.append(dict(scenario_id=id_,title=title,investigation_request=request,expected_status=status,expected_missing_data=[k for k,v in request['measurements'].items() if v is None],forbidden_equipment=[r['equipment_id'] for r in inventory if r['equipment_id'] not in request['available_equipment']],notes=note))
        return scenarios[-1]
    add('S01','Normal-looking fictional check-in',note='No disease inference. Ordinary status vocabulary requires Member 3 agreement.')
    add('S02','Fatigue and lower sleep',measurement={'sleep_hours':4.2},changes={'astronaut_id':'A02','symptoms':['fatigue']},note='Describe observed change only; no clinical threshold.')
    bp={'systolic_bp_mm_hg':None,'diastolic_bp_mm_hg':None}
    add('S03','Missing BP with usable monitor',measurement=bp,changes={'symptoms':['headache','dizziness'],'available_equipment':['bp_monitor','thermometer']},note='Monitor availability is a scenario override, not default inventory.')
    add('S04','Missing BP with monitor out of stock',measurement={**bp,'resting_hr_bpm':88,'sleep_hours':4.2},changes={'symptoms':['headache','dizziness'],'available_equipment':['thermometer']},status='needs_review',note='Matches the API v1 illustrative request. Exact checklist ranking is not pinned.')
    add('S05','One day sensor outage',measurement={'resting_hr_bpm':None,'sleep_hours':None},changes={'astronaut_id':'A03'},note='CSV outage is A03 on 2026-10-30. This request independently exercises missing values.')
    add('S06','Conflicting source records',note='BLOCKED: API v1 has no multiple-record/conflict field. Separate context fixture requires integration agreement.')
    add('S07','Reviewed checklist available',changes={'symptoms':['headache']},note='Do not require a particular rank; Member 3 must provide a reviewed/prototype catalog.')
    add('S08','Listed but unusable BP monitor',measurement=bp,changes={'symptoms':['headache']},note='Inventory override has BP quantity 1 but usable=false. Requires backend inventory-context test too.')
    add('S09','Earth communication offline',measurement=bp,changes={'symptoms':['headache']},note='Offline flag alone does not prove offline operation; run socket-blocked engine test and disconnected UI procedure.')
    add('S10','Manual emergency override',changes={'emergency_override':True},status='escalate')
    add('S11','Deterministic replay',measurement=bp,changes={'symptoms':['headache']},note='Repeat identical request at fixed rule version; compare entire engine output.')
    add('S12','Empty eligible checklist catalog',changes={'available_equipment':[]},status='insufficient_evidence',note='Requires empty candidate catalog via test adapter. Empty equipment alone is insufficient: equipment-free checks may still exist.')
    add('S13','Invalid measurement type',measurement={'resting_hr_bpm':'not-a-number'},note='Intentionally invalid negative fixture; API must reject with validation_error envelope. Not an engine input.')
    add('S14','Synthetic provenance preserved',changes={'astronaut_id':'A04'})
    add('S15','All four measurements unknown',measurement={k:None for k in base['measurements']})
    add('S16','Emergency override with all data missing',measurement={k:None for k in base['measurements']},changes={'available_equipment':[],'emergency_override':True},status='escalate')
    write_json(root/'scenarios/scenarios.json',scenarios)
    write_json(root/'scenarios/context.json',{
        'S03':{'inventory':[dict(equipment_id='bp_monitor',label='Blood-pressure monitor',quantity=1,usable=True,dataset_type='synthetic'),inventory[0]]},
        'S04':{'inventory':[inventory[0],inventory[1]]},
        'S06':{'blocked_reason':'No agreed API v1 representation for conflicting records. Do not flatten or silently pick a reading.', 'records':[{'source':'synthetic:S06_sensor','resting_hr_bpm':70},{'source':'synthetic:S06_manual','resting_hr_bpm':90}]},
        'S08':{'inventory':[inventory[0],{**inventory[1],'quantity':1,'usable':False},inventory[3]],'unusable_reason':'Fictional calibration failure; expiry is not an API v1 field.'},
        'S12':{'candidate_checks':[], 'source':'synthetic:S12'}})
    write_json(root/'synthetic/baselines.json',{p['astronaut_id']:{'resting_hr_bpm':round(sum(r['resting_hr_bpm'] for r in health if r['astronaut_id']==p['astronaut_id'] and r['observed_at'][:10]<'2026-10-23')/7,2),'sleep_hours':round(sum(r['sleep_hours'] for r in health if r['astronaut_id']==p['astronaut_id'] and r['observed_at'][:10]<'2026-10-23')/7,2),'dataset_type':'synthetic'} for p in crew})
    write_json(root/'sources/provenance.json',dict(version=VERSION,dataset_type='synthetic',generator='data/generate_seed.py',randomness='none; fixed arithmetic sequences',records=120,people=4,days_per_person=30,date_range=['2026-10-16','2026-11-14'],source='synthetic:member4-seed-v1',clinical_model=False,real_person_data=False,notes=['All people, inventory, measurements and scenarios are fictional.','Research references motivate scope only; no measurements or thresholds were derived from NASA.','Scenario measurements and supplied baselines are independent fixtures, not joins to historical CSV.','CSV numeric empty cells mean unknown; convert to JSON null, never zero.','CSV reported_symptoms is a JSON array; usable is lowercase true/false.','Baselines are first seven daily records, arithmetic mean; not clinical normal ranges.']))

if __name__=='__main__':
    generate()
