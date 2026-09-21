import Link from 'next/link';
import {
  getServiceCategoryEditor,
  serviceCategoryEditorPath,
} from '../../lib/service-category-editor';

type ServiceWorkspaceSection = 'general' | 'category';

export function ServiceWorkspaceHeader({
  businessId,
  serviceId,
  serviceName,
  serviceStatus,
  categoryName,
  categoryFamily,
  canWrite,
  currentSection,
  description,
}: {
  businessId: string;
  serviceId: string;
  serviceName: string;
  serviceStatus: string;
  categoryName: string;
  categoryFamily: string | null | undefined;
  canWrite: boolean;
  currentSection: ServiceWorkspaceSection;
  description: string;
}) {
  const editor = getServiceCategoryEditor(categoryFamily);
  const editorPath = serviceCategoryEditorPath(
    businessId,
    serviceId,
    categoryFamily,
  );
  const workspacePath = `/businesses/manage/${businessId}/services/${serviceId}`;
  const availabilityPath = `${workspacePath}/availability`;

  return (
    <header className="border-b border-slate-200 pb-5">
      <nav
        aria-label="Service workspace breadcrumbs"
        className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600"
      >
        <Link
          href={`/businesses/manage/${businessId}/services`}
          className="text-highland hover:underline focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          Services
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={workspacePath}
          className="truncate text-highland hover:underline focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          {serviceName}
        </Link>
        {currentSection === 'category' && editor ? (
          <>
            <span aria-hidden="true">/</span>
            <span className="text-slate-600">{editor.label}</span>
          </>
        ) : null}
      </nav>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-highland">
            Service workspace
          </p>
          <h1 className="mt-1 break-words text-2xl font-bold text-slate-950">
            {serviceName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {categoryName} <span aria-hidden="true">·</span>{' '}
            {categoryFamily ?? 'OTHER'} family
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {serviceStatus}
        </span>
      </div>
      <nav
        aria-label="Service workspace sections"
        className="mt-5 flex flex-wrap gap-2"
      >
        <Link
          href={workspacePath}
          aria-current={currentSection === 'general' ? 'page' : undefined}
          className={`min-h-10 rounded-md border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${
            currentSection === 'general'
              ? 'border-highland bg-emerald-50 text-highland'
              : 'border-slate-300 text-slate-700 hover:border-highland hover:text-highland'
          }`}
        >
          General
        </Link>
        {editor && editorPath ? (
          <Link
            href={editorPath}
            aria-current={currentSection === 'category' ? 'page' : undefined}
            className={`min-h-10 rounded-md border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${
              currentSection === 'category'
                ? 'border-highland bg-emerald-50 text-highland'
                : 'border-slate-300 text-slate-700 hover:border-highland hover:text-highland'
            }`}
          >
            {editor.label}
          </Link>
        ) : null}
        <Link
          href={availabilityPath}
          className="min-h-10 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          Availability
        </Link>
      </nav>
      {!canWrite ? (
        <p className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <strong>Read-only access.</strong> Staff can inspect this service and
          its category details, but cannot make changes.
        </p>
      ) : null}
    </header>
  );
}
