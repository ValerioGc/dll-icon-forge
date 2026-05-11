export type ProjectNoticeType = 'success' | 'warning';

export interface ProjectNotice {
  type: ProjectNoticeType;
  title: string;
  body: string;
}
