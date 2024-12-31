import React, { useState, useEffect, useRef } from 'react';
import useSound from 'use-sound';
import flipSound from './assets/flip.mp3'; // Replace with your sound file
import './App.css'; // Import the CSS file

function App() {
  const [isMotionActive, setIsMotionActive] = useState(false);
  const [play] = useSound(flipSound);
  const motionRef = useRef({
    previousAcceleration: null,
    lastTimestamp: null,
    isFlipping: false,
  });
  const [permissionState, setPermissionState] = useState(null)

  useEffect(() => {
      async function requestMotionPermission() {
         if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const permission = await DeviceMotionEvent.requestPermission();
          setPermissionState(permission);
        } else {
             setPermissionState('granted');
        }
       
      }
        if (isMotionActive) {
           requestMotionPermission()
        } else {
          setPermissionState(null)
        }
  }, [isMotionActive]);

 
   useEffect(() => {
      if(permissionState === 'granted' && isMotionActive) {
            window.addEventListener('devicemotion', handleDeviceMotion);
      }
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    }
  }, [isMotionActive, permissionState]);

  const handleStart = () => {
      setIsMotionActive(true);
  };

  const handleStop = () => {
    setIsMotionActive(false);
  }


  const handleDeviceMotion = (event) => {
    const { acceleration, timestamp } = event;
    const { previousAcceleration, lastTimestamp, isFlipping } = motionRef.current;

      //Handle Firefox and Chrome compatibility 
    const currentAcceleration = {
          x: acceleration?.x ?? event.accelerationIncludingGravity?.x,
          y: acceleration?.y ?? event.accelerationIncludingGravity?.y,
          z: acceleration?.z ?? event.accelerationIncludingGravity?.z
     };


      if (!currentAcceleration.x || !currentAcceleration.y || !currentAcceleration.z) {
       return;
    }

    if (!previousAcceleration) {
      motionRef.current = {
          previousAcceleration: currentAcceleration,
          lastTimestamp: timestamp,
          isFlipping: false
      };
      return;
    }

     const timeDiff = timestamp - lastTimestamp;
    const threshold = 45;
  

    // Simple flip detection logic (you may need to fine-tune this)
    const isFastMotion =
      (Math.abs(currentAcceleration.x - previousAcceleration.x) > threshold ||
       Math.abs(currentAcceleration.y - previousAcceleration.y) > threshold ||
        Math.abs(currentAcceleration.z - previousAcceleration.z) > threshold);
    

       if (isFastMotion && !isFlipping) {
             motionRef.current = { ...motionRef.current, isFlipping: true}
            play();
         setTimeout(() => {
             motionRef.current = { ...motionRef.current, isFlipping: false}
         }, 500);
    }
        
    motionRef.current = {
        previousAcceleration: currentAcceleration,
        lastTimestamp: timestamp
    };
  };

  return (
    <div className="app-container">
      <h1>Motion Sound Trigger</h1>
      {!isMotionActive ? (
       <button onClick={handleStart} className="action-button">Start Motion Detection</button>
       ): (
        <button onClick={handleStop} className="action-button">Stop Motion Detection</button>
       )
    }
     {permissionState === 'denied' &&  <p className="permission-denied"> Permission denied please reload and try again!</p>}
     {permissionState === 'prompt' &&  <p className="permission-prompt"> Safari permission is prompted!</p>}
    </div>
  );
}

export default App;