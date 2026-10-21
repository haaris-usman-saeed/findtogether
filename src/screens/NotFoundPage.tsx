import { LinkButton } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader documentTitle="Page not found" title="Page not found" lead="The address may be mistyped, or the page may have moved." />
      <LinkButton to="/" variant="primary">
        Go to home
      </LinkButton>
    </>
  );
}
