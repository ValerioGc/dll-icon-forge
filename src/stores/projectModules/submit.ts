import type { ComputedRef, Ref } from 'vue';
import { t } from '@/i18n';
import { notify } from '@/services/notifications';
import { buildDll, chooseOutputDll, ipcErrorMessage } from '@/services/tauriProject';
import type { BuildState } from '@/types/build';
import type { ProjectIcon } from '@/types/icons';
import type { ProjectMode } from '@/types/modes';
import type { ProjectNotice } from '@/types/notifications';
import { defaultOutputPath } from './files';

export interface ProjectSubmitState {
  mode: Ref<ProjectMode | null>;
  icons: Ref<ProjectIcon[]>;
  sourceLabel: Ref<string | null>;
  outputPath: Ref<string | null>;
  dirty: Ref<boolean>;
  buildState: Ref<BuildState>;
  lastError: Ref<string | null>;
  lastNotice: Ref<ProjectNotice | null>;
  canEditProject: ComputedRef<boolean>;
}

async function failSubmit(state: ProjectSubmitState, message: string): Promise<false> {
  state.lastError.value = message;
  state.lastNotice.value = null;
  state.buildState.value = 'error';
  await notify(t('notifications.errorTitle'), message);
  return false;
}

export async function submitProjectBuild(state: ProjectSubmitState): Promise<boolean> {
  if (!state.canEditProject.value) {
    return failSubmit(state, t('notifications.noEditSource'));
  }

  if (state.icons.value.length === 0) {
    return failSubmit(state, t('notifications.noIcons'));
  }

  state.buildState.value = 'validating';

  const invalidIcons = state.icons.value.filter((icon) => icon.status === 'error');

  if (invalidIcons.length > 0) {
    return failSubmit(state, t('notifications.invalidIcons', { count: invalidIcons.length }));
  }

  state.buildState.value = 'building';

  const selectedOutputPath = await chooseOutputDll(
    defaultOutputPath(state.mode.value, state.sourceLabel.value, state.outputPath.value),
  );

  if (!selectedOutputPath) {
    state.buildState.value = 'idle';
    return false;
  }

  try {
    const result = await buildDll({
      outputPath: selectedOutputPath,
      icons: state.icons.value.map((icon) => ({ id: icon.id })),
    });

    state.outputPath.value = result.outputPath;
    state.buildState.value = 'success';
    state.lastError.value = null;
    state.dirty.value = false;

    const notice = {
      type: 'success' as const,
      title: state.mode.value === 'edit'
        ? t('notifications.editSavedTitle')
        : t('notifications.createSavedTitle'),
      body: state.mode.value === 'edit'
        ? t('notifications.editSavedBody')
        : t('notifications.createSavedBody'),
    };
    state.lastNotice.value = notice;
    await notify(notice.title, notice.body);
    return true;
  } catch (error) {
    return failSubmit(state, ipcErrorMessage(error));
  }
}
