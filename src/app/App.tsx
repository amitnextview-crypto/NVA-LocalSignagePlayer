import React, { useEffect, useState, useRef } from "react";
import Immersive from "react-native-immersive";
import PlayerScreen from "../player/PlayerScreen";
import AdminButton from "../admin/AdminButton";
import AdminPanel from "../admin/AdminPanel";
import { findCMS } from "../services/serverService";




export default function App() {
  const [showAdmin, setShowAdmin] = useState(false);
const timer = useRef<any>(null);


const openAdmin = () => {
  setShowAdmin(true);

  clearTimeout(timer.current);
  timer.current = setTimeout(() => {
    setShowAdmin(false);
  }, 1000000); // 10 minutes
};

const [ready, setReady] = useState(false);

useEffect(() => {
  async function init() {
    try {
      await findCMS();
      setReady(true);
    } catch {
      console.log("CMS not found");
    }
  }

  init();
  (Immersive as any).on();
}, []);


  if (!ready) return null;

return (
  <>
    <PlayerScreen />
    <AdminButton onOpen={openAdmin} />
    <AdminPanel visible={showAdmin} onClose={() => setShowAdmin(false)} />
  </>
);
}
