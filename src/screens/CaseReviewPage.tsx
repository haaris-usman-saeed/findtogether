import { Lock } from 'lucide-react';
import { useParams } from 'react-router';
import { StatusBadge } from '../components/ui/Badge';
import { Loading, RequestErrorNotice } from '../components/ui/Feedback';
import { Notice } from '../components/ui/Notice';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { AccessNotice } from '../features/cases/AccessNotice';
import { CandidateCard } from '../features/cases/CandidateCard';
import { CaseHistory, RequestSummary, ReviewFlagNotice, SendForReview, SetAsideList } from '../features/cases/CasePanels';
import { StatusTrack } from '../features/cases/StatusTrack';
import { CASE_STATUS } from '../domain/status';
import { normalizeReference } from '../lib/reference';
import { api } from '../services';
import { useAsync } from '../state/async';
import { useSession } from '../state/session';

const SET_ASIDE = new Set(['ruled_out', 'declined']);
const IN_PROGRESS = new Set(['verifying', 'authorized', 'reconnected']);

export function CaseReviewPage() {
  const { reference = '' } = useParams();
  const { session } = useSession();
  const query = useAsync(() => api.getCase(reference, session), [reference, session.role]);
  const detail = query.data;
  const back = { to: '/cases', label: 'Cases' };

  if (!detail) {
    const title = `Case ${normalizeReference(reference)}`;
    if (query.error?.code === 'forbidden') {
      return (
        <>
          <PageHeader documentTitle="Case review" back={{ to: '/', label: 'Home' }} title={title} />
          <AccessNotice />
        </>
      );
    }
    if (query.error) {
      return (
        <>
          <PageHeader documentTitle="Case review" back={back} title={title} />
          <div className="max-w-form">
            <RequestErrorNotice kind="load" error={query.error} onRetry={query.reload} retrying={query.loading} />
          </div>
        </>
      );
    }
    return <Loading label="Loading case" />;
  }

  const active = detail.candidates.filter((c) => !SET_ASIDE.has(c.review.state));
  const setAside = detail.candidates.filter((c) => SET_ASIDE.has(c.review.state));
  const busy = active.find((c) => IN_PROGRESS.has(c.review.state));
  const contactUnderway = active.some((c) => c.review.state === 'authorized' || c.review.state === 'reconnected');

  return (
    <>
      <PageHeader
        documentTitle={`Case ${detail.reference}`}
        back={back}
        title={`Looking for ${detail.request.soughtName}`}
        lead={`${detail.reference}. ${CASE_STATUS[detail.status].description}`}
        aside={<StatusBadge status={detail.status} />}
      />

      <StatusTrack status={detail.status} />

      {query.error && (
        <div className="mt-6">
          <RequestErrorNotice kind="load" error={query.error} onRetry={query.reload} retrying={query.loading} />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-12">
        {/* On small screens the matches come first; the request summary follows. */}
        <div className="order-2 lg:sticky lg:top-6 lg:order-none lg:self-start">
          <RequestSummary request={detail.request} />
        </div>

        <div className="order-1 min-w-0 space-y-10 lg:order-none">
          {detail.safeguarding ? (
            <div className="space-y-4">
              <Notice tone="guarded" icon={Lock} title="Referred to the safeguarding team">
                <p>This search is for a child. Possible matches are visible only to the safeguarding lead.</p>
                <p>
                  Before anything is shared, the safeguarding team confirms who the child is with and whether the person asking
                  has parental responsibility. Saying they’re the parent is not enough on its own.
                </p>
              </Notice>
              <Notice tone="demo">
                <p>
                  The safeguarding workflow is outside this demo. Children’s records never enter ordinary matching, so
                  coordinators see no candidates here.
                </p>
              </Notice>
            </div>
          ) : (
            <>
              <section aria-labelledby="matches-title" className="space-y-5">
                <div>
                  <SectionHeading id="matches-title" count={active.length}>
                    Possible matches
                  </SectionHeading>
                  {active.length > 0 && (
                    <p className="mt-1 max-w-prose text-sm text-ink-muted">
                      Listed by how many details agree. The order is not a confidence rating, and none of these is confirmed.
                    </p>
                  )}
                </div>
                <ReviewFlagNotice caseDetail={detail} onUpdate={query.setData} />
                {active.length === 0 ? (
                  <div className="rounded-md border border-dashed border-line-strong px-5 py-6">
                    <p className="font-semibold">No possible matches right now</p>
                    <p className="mt-1 max-w-prose text-ink-muted">
                      New registrations are checked against this request automatically. People who haven’t agreed to family
                      search never appear here.
                    </p>
                  </div>
                ) : (
                  active.map((candidate) => (
                    <CandidateCard
                      key={candidate.registrationReference}
                      caseDetail={detail}
                      candidate={candidate}
                      blockedBy={busy && busy !== candidate ? busy.registrationReference : undefined}
                      onUpdate={query.setData}
                    />
                  ))
                )}
              </section>

              {active.length > 0 && !detail.reviewFlag && !contactUnderway && (
                <SendForReview caseDetail={detail} onUpdate={query.setData} />
              )}

              {setAside.length > 0 && <SetAsideList candidates={setAside} />}

              <Notice tone="demo">
                <p>
                  Verification here is simulated. Recording an outcome writes down what a coordinator says happened. It does
                  not check anyone’s identity. A real system needs authenticated staff accounts and server-side checks on
                  every step.
                </p>
              </Notice>
            </>
          )}

          <CaseHistory history={detail.history} />
        </div>
      </div>
    </>
  );
}
