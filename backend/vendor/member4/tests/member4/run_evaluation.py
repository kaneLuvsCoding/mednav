"""Run actual tests and record counts; skipped tests never count as passed."""
import json
from pathlib import Path
import sys
import unittest
from datetime import datetime, timezone

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT))
sys.path.insert(0,str(HERE))
loader=unittest.TestLoader()
suite=loader.discover(str(HERE),pattern='test_*.py')
result=unittest.TextTestRunner(verbosity=2).run(suite)
# Failure events can include subtests, so count unique parent test methods.
def parent_name(test): return test.id().split(' (',1)[0]
failed={parent_name(t) for t,_ in result.failures+result.errors}
skipped={parent_name(t) for t,_ in result.skipped}
report={
    'executed_at_utc':datetime.now(timezone.utc).isoformat(),
    'unit':'test methods (subtest failures collapsed to parent)',
    'total':result.testsRun,'passed':result.testsRun-len(failed|skipped),
    'failed_or_error':len(failed),'skipped':len(skipped),
    'skip_reasons':[{'test':t.id(),'reason':reason} for t,reason in result.skipped],
    'failures':[{'test':t.id(),'traceback':trace} for t,trace in result.failures+result.errors],
    'clinical_validation':False,
    'limitations':'Fixture/harness results are not engine or UI performance. Inspect skips; disconnected full-app operation and baseline comparison require integrated code.'}
path=ROOT/'docs/evaluation_results.json'
path.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('total','passed','failed_or_error','skipped')},indent=2))
raise SystemExit(0 if result.wasSuccessful() else 1)
