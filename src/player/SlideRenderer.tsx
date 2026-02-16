import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { getMediaFiles } from '../services/mediaService';
import { findCMS, getServer } from "../services/serverService";



export default function SlideRenderer({ config, sectionIndex }: any) {
  const [files, setFiles] = useState<any[]>([]);
  const [index, setIndex] = useState(0);


  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const scale = useRef(new Animated.Value(0.95)).current;

  const [server, setServer] = useState("");

useEffect(() => {
  async function init() {
    try {
      const url = getServer();
      setServer(url);
    } catch {}
  }
  init();
}, []);


useEffect(() => {
  Animated.spring(scale, {
    toValue: 1,
    useNativeDriver: true
  }).start();
}, [index]);


useEffect(() => {
  if (!server) return;

  const load = async () => {
    const list = await getMediaFiles(sectionIndex);
    setFiles(list || []);
  };

  load();
}, [sectionIndex, server]);


  useEffect(() => {
    if (!files.length) return;

    clearTimeout(timerRef.current);

    const file = files[index];
    const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);

    if (!isVideo) {
      timerRef.current = setTimeout(() => {
        goNext();
      }, (config?.slideDuration || 5) * 1000);
    }

    return () => clearTimeout(timerRef.current);
  }, [index, files, config]);

  const goNext = () => {
  if (!files.length) return;

  const direction =
  config?.sections?.[sectionIndex]?.slideDirection || 'left';


  const distanceX = 300;
  const distanceY = 300;

  // Reset values
  translateX.setValue(0);
  translateY.setValue(0);

  if (direction === 'left') {
    translateX.setValue(distanceX);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true
    }).start();
  }

  if (direction === 'right') {
    translateX.setValue(-distanceX);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true
    }).start();
  }

  if (direction === 'top') {
    translateY.setValue(distanceY);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true
    }).start();
  }

  if (direction === 'bottom') {
    translateY.setValue(-distanceY);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true
    }).start();
  }

  setIndex(prev =>
    files.length === 1 ? prev : (prev + 1) % files.length
  );
};

const translateY = useRef(new Animated.Value(0)).current;

  if (!files.length) {
    return <View style={styles.container} />;
  }

  const file = files[index];
  const uri = server + file.url;

  const isVideo = /\.(mp4|mkv|webm)$/i.test(file.name);

  return (
    <Animated.View
      style={[
        styles.container,
        {
 transform: [
  { translateX },
  { translateY },
  { scale }
]
}

      ]}
    >
      {isVideo ? (
        <Video
          key={file.name + index}
          source={{ uri }}
          style={styles.media}
          muted
          resizeMode="stretch"
          repeat={files.length === 1}
          onEnd={() => files.length > 1 && goNext()}
        />
      ) : (
        <Image
          source={{ uri }}
          style={styles.media}
          resizeMode="stretch"
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
});


