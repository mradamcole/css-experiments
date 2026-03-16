const HOME_LOCKUP_STORAGE_KEY = "clairiva-home-lockup";

const brandLogo = document.getElementById("brand-logo");
const brandWordmark = document.getElementById("brand-wordmark");
const brandLineTop = document.getElementById("brand-line-top");
const brandLineBottom = document.getElementById("brand-line-bottom");

function applyStoredLockup() {
  let savedLockup = null;

  try {
    savedLockup = window.sessionStorage.getItem(HOME_LOCKUP_STORAGE_KEY);
    window.sessionStorage.removeItem(HOME_LOCKUP_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read Clairiva home lockup.", error);
  }

  if (!savedLockup) {
    return;
  }

  try {
    const styles = JSON.parse(savedLockup);

    if (styles.logoStyle) {
      brandLogo.style.cssText = styles.logoStyle;
    }

    if (styles.wordmarkStyle) {
      brandWordmark.style.cssText = styles.wordmarkStyle;
    }

    if (styles.lineTopStyle) {
      brandLineTop.style.cssText = styles.lineTopStyle;
    }

    if (styles.lineBottomStyle) {
      brandLineBottom.style.cssText = styles.lineBottomStyle;
    }
  } catch (error) {
    console.warn("Unable to restore Clairiva home lockup.", error);
  }
}

async function showHomepage() {
  applyStoredLockup();

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  document.body.dataset.ready = "true";
}

showHomepage();
