// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyA-NIM0pbgU2w85mWFhqUEkbA3L0_NrimI",
    authDomain: "despachador-58fb8.firebaseapp.com",
    projectId: "despachador-58fb8",
    storageBucket: "despachador-58fb8.firebasestorage.app",
    messagingSenderId: "1024295745401",
    appId: "1:1024295745401:web:8d49683a86a8b1ff7aa1a8"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Este bloque despierta al celular cuando la app está CERRADA
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Notificación recibida en segundo plano', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/784/784115.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/784/784115.png',
        vibrate: [200, 100, 200, 100, 200, 100, 200] // Patrón de vibración tipo alarma
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
