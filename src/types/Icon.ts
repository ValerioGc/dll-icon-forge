export default interface IconItem {
  id: string;
  src: string;
  alt: string;
  name: string;
  fileName: string;
  sizeLabel: string;
  status: 'ready' | 'warning' | 'error';
}

export type AppMode = 'create' | 'edit';

export type MenuAction = 'add' | 'delete' | 'clear';
