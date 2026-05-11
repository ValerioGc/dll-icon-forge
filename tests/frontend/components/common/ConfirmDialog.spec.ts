import { describe, expect, it, beforeEach } from 'vitest';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog.vue';
import { mountComponent, resetFrontendTestState } from '../../helpers/mount';

const teleportStub = { template: '<div><slot /></div>' };

function mountDialog(extraProps: Record<string, unknown> = {}) {
  return mountComponent(ConfirmDialog, {
    props: {
      title: 'Conferma',
      message: 'Sei sicuro?',
      ...extraProps,
    },
    global: { stubs: { Teleport: teleportStub } },
  });
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    resetFrontendTestState();
  });

  it('renders title and message', () => {
    const wrapper = mountDialog();
    expect(wrapper.find('.confirm_dialog_title').text()).toBe('Conferma');
    expect(wrapper.find('.confirm_dialog_message').text()).toBe('Sei sicuro?');
  });

  it('uses default i18n labels as accessible icon button labels', () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAll('button');

    expect(buttons[0].text()).toBe('');
    expect(buttons[0].attributes('title')).toBe('Annulla');
    expect(buttons[0].attributes('aria-label')).toBe('Annulla');
    expect(buttons[1].text()).toBe('');
    expect(buttons[1].attributes('title')).toBe('Conferma');
    expect(buttons[1].attributes('aria-label')).toBe('Conferma');
  });

  it('uses custom confirmLabel and cancelLabel as icon button labels', () => {
    const wrapper = mountDialog({ confirmLabel: 'Si', cancelLabel: 'No' });
    const buttons = wrapper.findAll('button');

    expect(buttons[0].attributes('title')).toBe('No');
    expect(buttons[0].attributes('aria-label')).toBe('No');
    expect(buttons[1].attributes('title')).toBe('Si');
    expect(buttons[1].attributes('aria-label')).toBe('Si');
  });

  it('renders close and save icons inside the action buttons', () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAll('button');

    expect(buttons[0].find('img').exists()).toBe(true);
    expect(buttons[1].find('img').exists()).toBe(true);
  });

  it('emits confirm when the confirm button is clicked', async () => {
    const wrapper = mountDialog();
    await wrapper.get('.confirm_dialog_btn_confirm').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('emits cancel when the cancel button is clicked', async () => {
    const wrapper = mountDialog();
    const [cancelBtn] = wrapper.findAll('button');
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('emits cancel when the overlay backdrop is clicked', async () => {
    const wrapper = mountDialog();
    await wrapper.get('.confirm_overlay').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('uses a native dialog with the correct aria attributes', () => {
    const wrapper = mountDialog();
    const dialog = wrapper.get('dialog.confirm_dialog');
    expect(dialog.attributes('open')).toBeDefined();
    expect(dialog.attributes('role')).toBeUndefined();
    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-label')).toBe('Conferma');
  });
});
