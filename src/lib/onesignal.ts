// OneSignal Web SDK Integration for Lojas Maxx

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || "d14a51eb-9877-4b77-bc60-bc0f17112026"; // Fallback placeholder ID

// Safely load the OneSignal SDK dynamically to avoid blocking standard load
export function initOneSignal() {
  if (typeof window === "undefined") return;

  // Prevent duplicate script elements
  if (document.getElementById("onesignal-sdk")) return;

  const script = document.createElement("script");
  script.id = "onesignal-sdk";
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.defer = true;
  
  script.onload = () => {
    try {
      const OneSignal = (window as any).OneSignal || [];
      OneSignal.push(async () => {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true, // Enable for development/preview testing
          notifyButton: {
            enable: false,
          },
        });
        console.log("[OneSignal] Web SDK initialized successfully with App ID:", ONESIGNAL_APP_ID);
      });
    } catch (err) {
      console.error("[OneSignal] Initialization error:", err);
    }
  };

  document.head.appendChild(script);
}

// Associate the logged in User ID with OneSignal external_id for targeted pushes
export function loginOneSignalUser(userId: string) {
  if (typeof window === "undefined") return;
  
  const OneSignal = (window as any).OneSignal || [];
  OneSignal.push(async () => {
    try {
      if (OneSignal.login) {
        await OneSignal.login(userId);
        console.log("[OneSignal] Linked user session with external ID:", userId);
      } else {
        // Fallback for older versions of the SDK
        await OneSignal.setExternalUserId(userId);
        console.log("[OneSignal] Set external user ID (legacy):", userId);
      }
    } catch (err) {
      console.error("[OneSignal] Login user ID error:", err);
    }
  });
}

// Clears user association on logout
export function logoutOneSignalUser() {
  if (typeof window === "undefined") return;

  const OneSignal = (window as any).OneSignal || [];
  OneSignal.push(async () => {
    try {
      if (OneSignal.logout) {
        await OneSignal.logout();
        console.log("[OneSignal] Unlinked user session");
      } else {
        // Fallback for older versions of the SDK
        await OneSignal.removeExternalUserId();
        console.log("[OneSignal] Removed external user ID (legacy)");
      }
    } catch (err) {
      console.error("[OneSignal] Logout error:", err);
    }
  });
}

// Request permission
export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const OneSignal = (window as any).OneSignal || [];
  return new Promise((resolve) => {
    OneSignal.push(async () => {
      try {
        if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
          await OneSignal.Notifications.requestPermission();
          const permission = OneSignal.Notifications.permission;
          resolve(permission === "granted" || permission === true);
        } else {
          // Fallback legacy request
          await OneSignal.registerForPushNotifications();
          resolve(true);
        }
      } catch (err) {
        console.error("[OneSignal] Error requesting permission:", err);
        resolve(false);
      }
    });
  });
}