<script>
  import { announcementsUi } from '$lib/announcements/announcementsUi.svelte.js';
  import { t } from '$lib/i18n/i18n.svelte.js';

  let { onBack, onOpen, onClose } = $props();
</script>

<button class="sub-head text" data-icon="&#xe027;" onclick={onBack}>{t('Announcements')}</button>
<div class="board-settings">
  <section class="board-setting">
    <h2>{t('Show announcements')}</h2>
    <group class="radio">
      <div>
        <input
          type="radio"
          id="announcements-yes"
          name="announcements-shown"
          checked={!announcementsUi.disabled}
          onchange={() => announcementsUi.setDisabled(false)}
        />
        <label for="announcements-yes">{t('Yes')}</label>
      </div>
      <div>
        <input
          type="radio"
          id="announcements-no"
          name="announcements-shown"
          checked={announcementsUi.disabled}
          onchange={() => announcementsUi.setDisabled(true)}
        />
        <label for="announcements-no">{t('No')}</label>
      </div>
    </group>
  </section>
  <hr class="board-settings-divider" />
  <a class="text" href="/updates" onclick={onClose}>{t('See all updates')}</a>
  <div class="announcements-open">
    <button class="button" onclick={onOpen}>{t('Open Announcements')}</button>
  </div>
</div>
