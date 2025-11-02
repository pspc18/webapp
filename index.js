import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background Message:', remoteMessage);
  await displayNotification(remoteMessage);
});

// Foreground message handler
messaging().onMessage(async remoteMessage => {
  console.log('Foreground Message:', remoteMessage);
  await displayNotification(remoteMessage);
});

async function displayNotification(remoteMessage) {
  // Create a channel (required for Android custom sound)
const channelId = await notifee.createChannel({
  id: remoteMessage.notification?.android?.channelId || 'default',
  name: remoteMessage.notification?.android?.channelId || 'Default Channel',
  sound: remoteMessage.notification?.android?.sound || 'notification', // Without extension
  importance: AndroidImportance.HIGH,
});

  // Display notification
  await notifee.displayNotification({
    title: remoteMessage.notification?.android?.title || 'Notification',
    body: remoteMessage.notification?.android?.body || 'Message received!',
    android: {
      channelId,
      sound:remoteMessage.notification?.android?.sound || 'notification',
      pressAction: {
        id: 'default',
      },
    },
  });
}

AppRegistry.registerComponent(appName, () => App);
