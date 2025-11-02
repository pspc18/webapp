// App.js
import React, { useEffect, useState, useRef } from 'react';
import { View, Alert, ToastAndroid, Platform, PermissionsAndroid } from 'react-native';
import { WebView } from 'react-native-webview';
import messaging from '@react-native-firebase/messaging';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFetchBlob from 'rn-fetch-blob';

export default function App() {
  const [userInfo, setUserInfo] = useState(null);
  const [deviceToken, setDeviceToken] = useState(null);
  const currentUrl = useRef('');
  const downloadTask = useRef(null);

  // FCM Setup
  useEffect(() => {
    const setup = async () => {
      try {
        if (Platform.OS === 'android' && Platform.Version >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        const status = await messaging().requestPermission();
        if (status === 1 || status === 2) {
          const token = await messaging().getToken();
          setDeviceToken(token);
          await AsyncStorage.setItem('fcmToken', token);
        }
      } catch (e) {}
    };
    setup();

    const unsub = messaging().onMessage(msg => {});

    return unsub;
  }, []);

  // Send Token
  useEffect(() => {
    if (userInfo && deviceToken) {
      const id = userInfo.id || userInfo.user_id;
      const model = userInfo.modal || userInfo.model;
      if (id && model) {
        axios.post('https://kotacareer.rusofterp.com/api/saveDeviceToken', {
          userId: id,
          model,
          device_token: deviceToken,
        }).catch(() => {});
      }
    }
  }, [userInfo, deviceToken]);

  // MIME
  const getMime = (name) => {
    const ext = name.split('.').pop()?.toLowerCase();
    const map = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      zip: 'application/zip',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    };
    return map[ext] || 'application/octet-stream';
  };

  // TIMESTAMP FILENAME
  const getTimestampFileName = (originalName) => {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const timestamp = `${date}_${time}`;
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'pdf';
    const base = originalName.replace(`.${ext}`, '');
    return `${base}_${timestamp}.${ext}`;
  };

  // DOWNLOAD + FOLDER + ALERT
  const downloadFile = async (url) => {
    if (!url.startsWith('http')) return;

    if (downloadTask.current) {
      downloadTask.current.cancel();
      downloadTask.current = null;
    }

    try {
      const { config, fs } = RNFetchBlob;
      const DownloadDir = fs.dirs.DownloadDir;
      const KotaCareerDir = `${DownloadDir}/Kota-Career`;

      // FORCE CREATE FOLDER (Android 10+ fix)
      try {
        if (!(await fs.exists(KotaCareerDir))) {
          await fs.mkdir(KotaCareerDir);
          console.log('Folder created:', KotaCareerDir);
        }
      } catch (mkdirErr) {
        console.warn('mkdir failed, trying fallback...', mkdirErr);
      }

      // Fallback: Use DocumentDir if Download fails
      const finalDir = (await fs.exists(KotaCareerDir)) ? KotaCareerDir : fs.dirs.DocumentDir + '/Kota-Career';
      if (!(await fs.exists(finalDir))) {
        await fs.mkdir(finalDir);
      }

      let originalName = url.split('/').pop().split('?')[0] || `file_${Date.now()}.pdf`;
      const finalName = getTimestampFileName(originalName);
      const filePath = `${finalDir}/${finalName}`;

      ToastAndroid.show(`Downloading: ${finalName}`, ToastAndroid.SHORT);

      const task = config({
        fileCache: true,
        path: filePath, // MUST BE SET
      })
      .fetch('GET', url)
      .progress((received, total) => {
        const percent = Math.floor((received / total) * 100);
        if (percent > 0 && percent % 25 === 0) {
          ToastAndroid.show(`${percent}%`, ToastAndroid.SHORT);
        }
      });

      downloadTask.current = task;
      const res = await task;

      // Add to notification (clickable)
      RNFetchBlob.android.addCompleteDownload({
        title: finalName,
        description: 'Tap to open',
        mime: getMime(finalName),
        path: res.path(),
        showNotification: true,
      });

      // SUCCESS ALERT
      Alert.alert(
        'Download Complete!',
        `File saved successfully!\n\n` +
        `Location:\n` +
        `Download > Kota-Career > ${finalName}\n\n` +
        `Or check notification area and tap to open.`,
        [{ text: 'OK' }]
      );

      downloadTask.current = null;

    } catch (err) {
      console.error('Download error:', err);
      if (!err.message?.includes('canceled')) {
        Alert.alert('Download Failed', 'Please try again.');
      }
      downloadTask.current = null;
    }
  };

  // BLOCK LINK
  const handleNav = (navState) => {
    const { url } = navState;
    if (url === currentUrl.current) return true;

    const downloadable = ['.pdf', '.doc', '.docx', '.zip', '.jpg', '.png'];
    const isDownload = downloadable.some(e => url.toLowerCase().includes(e));

    if (isDownload) {
      currentUrl.current = url;
      setTimeout(() => currentUrl.current = '', 1000);
      downloadFile(url);
      return false;
    }

    currentUrl.current = url;
    return true;
  };

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: 'https://kotacareer.rusofterp.com' }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onNavigationStateChange={handleNav}
        injectedJavaScript={`
          setTimeout(() => {
            const u = localStorage.getItem('user');
            window.ReactNativeWebView.postMessage(u || 'null');
          }, 3000);
          true;
        `}
        onMessage={(e) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data && data !== 'null') {
              setUserInfo(data);
              AsyncStorage.setItem('userInfo', JSON.stringify(data));
            }
          } catch {}
        }}
      />
    </View>
  );
}