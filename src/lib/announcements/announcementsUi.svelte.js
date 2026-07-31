import { browser } from '$app/environment';

const DISABLED_KEY = 'announcements:disabled';

class AnnouncementsUi {
  openRequested = $state(false);
  disabled = $state(browser && localStorage.getItem(DISABLED_KEY) === 'true');

  requestOpen() {
    this.openRequested = true;
  }

  clearRequest() {
    this.openRequested = false;
  }

  setDisabled = (value) => {
    this.disabled = value;
    localStorage.setItem(DISABLED_KEY, String(value));
  };
}

export const announcementsUi = new AnnouncementsUi();
