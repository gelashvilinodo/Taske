import type { CSSProperties } from 'react';
import type { Project } from '@/lib/tasks/model';

/** CSS variable that colours a card, chip or tile with the project's colour. */
export const projectStyle = (p: Project | undefined, name: '--pj' | '--c' = '--c') =>
  (p ? ({ [name]: p.color } as CSSProperties) : undefined);

const initial = (name: string) => (name.trim()[0] || '?').toUpperCase();

/** Square logo tile: the uploaded logo, or the first letter on the project colour. */
export function ProjectLogo({ project, size = 'sm' }: { project: Pick<Project, 'name' | 'color' | 'logo'>; size?: 'xs' | 'md' | 'sm' | 'lg' }) {
  return (
    <span className={'pj-logo pj-logo-' + size + (project.logo ? ' has-img' : '')} style={{ '--c': project.color } as CSSProperties} aria-hidden="true">
      {project.logo ? <img src={project.logo} alt="" /> : initial(project.name)}
    </span>
  );
}

/** Project chip used on cards, rows and summaries. Shows "No project" when there is none. */
export function ProjectChip({ project, suffix }: { project: Project | undefined; suffix?: string | number }) {
  if (!project) return <span className="chip">No project{suffix !== undefined ? ' ' + suffix : ''}</span>;
  return (
    <span className="chip chip-project" style={projectStyle(project)}>
      <ProjectLogo project={project} size="xs" />
      {project.name}{suffix !== undefined ? ' ' + suffix : ''}
    </span>
  );
}
