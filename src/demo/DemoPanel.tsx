/**
 * Reviewer tools. Clearly separated from the product: dashed styling, its own
 * label, and it is not rendered at all when the app talks to a real backend.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { FlaskConical, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button';
import { ChoiceGroup } from '../components/ui/Choice';
import { emptyRegistrationDraft } from '../forms/registrationForm';
import { emptySearchDraft } from '../forms/searchForm';
import { api, mockBackend } from '../services';
import { toApiError, type RequesterStatusView } from '../services/contracts';
import { networkSimulation, type NetworkMode } from '../services/mock/networkSimulation';
import { SCENARIO_REFS } from '../services/mock/seed';
import { useDraftStore } from '../state/drafts';
import { useSession } from '../state/session';
import { useDemo } from './DemoContext';
import { SCENARIOS, type Scenario } from './scenarios';

function ProtectedComparison() {
  const { session } = useSession();
  const latest = mockBackend?.inspect.latestSearchReference() ?? null;
  const record = mockBackend?.inspect.protectedRecord() ?? null;
  const [result, setResult] = useState<{ victor: RequesterStatusView; control: RequesterStatusView } | string | null>(null);
  const [busy, setBusy] = useState(false);

  const compare = async () => {
    if (!latest) {
      setResult('Save the prefilled search request first.');
      return;
    }
    setBusy(true);
    try {
      const [victor, control] = await Promise.all([
        api.getRequesterStatus(latest, session),
        api.getRequesterStatus(SCENARIO_REFS.control, session),
      ]);
      setResult({ victor, control });
    } catch (error) {
      setResult(toApiError(error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-dashed border-ink-faint pt-4">
      <h3 className="font-semibold">Behind the neutral response</h3>
      {record && (
        <p className="text-sm">
          {record.reference} exists at {record.shelterName} with a safety concern recorded and family search declined. It is
          removed before matching runs, so coordinators never see it either.
        </p>
      )}
      <Button onClick={compare} loading={busy}>
        Compare requester responses
      </Button>
      {typeof result === 'string' && <p className="text-sm text-danger">{result}</p>}
      {result && typeof result !== 'string' && (
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Victor’s request ({result.victor.reference})</p>
          <pre className="overflow-x-auto rounded border border-line bg-surface p-2 text-[0.8125rem]">{JSON.stringify(result.victor, null, 2)}</pre>
          <p className="font-semibold">Control: {result.control.reference}, nobody matching is registered</p>
          <pre className="overflow-x-auto rounded border border-line bg-surface p-2 text-[0.8125rem]">{JSON.stringify(result.control, null, 2)}</pre>
          <p>
            {result.victor.stage === result.control.stage
              ? 'Same response. Only the reference differs, so the requester can’t tell a protected record from no record.'
              : 'The responses differ. That would be a privacy bug.'}
          </p>
        </div>
      )}
    </div>
  );
}

export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { session, setRole } = useSession();
  const drafts = useDraftStore();
  const navigate = useNavigate();
  const demo = useDemo();
  const network = useSyncExternalStore(networkSimulation.subscribe, networkSimulation.get, networkSimulation.get);
  const active = SCENARIOS.find((s) => s.id === demo.activeScenario) ?? null;

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!mockBackend) return null;
  const backend = mockBackend;

  const ping = () => api.getShelters(session).catch(() => undefined);

  const resetData = (scenario: Scenario | null) => {
    backend.reset();
    networkSimulation.set({ mode: 'normal' });
    void ping();
    drafts.replace('registration', emptyRegistrationDraft(session.shelterId));
    drafts.replace('search', scenario?.prefillSearch ? scenario.prefillSearch() : emptySearchDraft(session.shelterId));
    demo.restart(scenario?.id ?? null);
  };

  const load = (scenario: Scenario) => {
    resetData(scenario);
    setRole(scenario.role);
    setOpen(false);
    navigate(scenario.start);
  };

  const setNetwork = (mode: NetworkMode) => {
    networkSimulation.set({ mode });
    void ping();
  };

  return (
    <div className="print:hidden">
      {!open && (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={active ? `Reviewer tools, scenario ${active.id}` : 'Reviewer tools'}
          className="fixed bottom-4 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded border border-dashed border-ink-faint bg-surface px-3 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{active ? `Reviewer tools: scenario ${active.id}` : 'Reviewer tools'}</span>
          <span className="sm:hidden">{active ? `Tools ${active.id}` : 'Tools'}</span>
        </button>
      )}
      {open && (
        <aside
          role="dialog"
          aria-modal="false"
          aria-labelledby="demo-title"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto border-t-2 border-dashed border-ink-faint bg-[#FAF9F6] px-5 pb-6 pt-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[25rem] sm:rounded-md sm:border-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="demo-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold focus:outline-none">
                Reviewer tools
              </h2>
              <p className="text-sm text-ink-muted">
                Not part of FindTogether. This panel exists only in the demo build, to load scenarios and simulate conditions.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close reviewer tools"
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-sunk hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {active && (
            <div className="mt-4 rounded border border-line bg-surface p-3">
              <p className="text-sm font-semibold">
                Scenario {active.id}: {active.title}
              </p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm">
                {active.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {active.id === 3 && (
                <div className="mt-3">
                  <ProtectedComparison />
                </div>
              )}
            </div>
          )}

          <section className="mt-5" aria-labelledby="demo-scenarios">
            <h3 id="demo-scenarios" className="font-semibold">
              Scenarios
            </h3>
            <p className="text-sm text-ink-muted">Each one resets the demo data first.</p>
            <ul className="mt-2 space-y-2">
              {SCENARIOS.map((scenario) => (
                <li key={scenario.id}>
                  <button
                    type="button"
                    onClick={() => load(scenario)}
                    className="w-full rounded border border-line-strong bg-surface px-3 py-2.5 text-left hover:border-ink-muted"
                  >
                    <span className="block font-semibold text-ink">
                      {scenario.id}. {scenario.title}
                    </span>
                    <span className="block text-sm text-ink-muted">{scenario.summary}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-muted">
              To watch a match form live, search for “Robert Tran,” about 30 to 44. He’s registered as Bobby.
            </p>
          </section>

          <div className="mt-5 space-y-5">
            <ChoiceGroup
              id="demo-role"
              compact
              legend="Signed in as"
              hint="Simulated. The mock backend checks this role on every request."
              layout="inline"
              value={session.role}
              onChange={setRole}
              options={[
                { value: 'volunteer', label: 'Volunteer' },
                { value: 'coordinator', label: 'Coordinator' },
              ]}
            />
            <ChoiceGroup
              id="demo-network"
              compact
              legend="Network"
              layout="inline"
              value={network.mode}
              onChange={setNetwork}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'slow', label: 'Slow' },
                { value: 'failing', label: 'Requests fail' },
                { value: 'offline', label: 'Offline' },
              ]}
            />
            <Button
              variant="quiet"
              onClick={() => {
                resetData(null);
                setOpen(false);
                navigate('/');
              }}
            >
              Reset demo data
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}
