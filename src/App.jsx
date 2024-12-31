import React, { useState, useEffect, useRef } from 'react';
import useSound from 'use-sound';
import flipSound from './assets/flip.mp3';
import './App.css';

function App() {
    const [isMotionActive, setIsMotionActive] = useState(false);
    const [play, { stop, isPlaying, load }] = useSound(flipSound, {
        onplay: () => {
            load();
        },
    });
    const motionRef = useRef({
        previousAcceleration: null,
        isFlipping: false,
        initialBias: { x: 0, y: 0, z: 0 },
    });
    const [motionData, setMotionData] = useState({ x: 0, y: 0, z: 0 });
    const [browser, setBrowser] = useState('');
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [isDeviceMotionSupported, setIsDeviceMotionSupported] = useState(false);

    useEffect(() => {
        // Check if DeviceMotionEvent is supported
        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            setIsDeviceMotionSupported(true);
        }

        // Get the browser info
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Firefox')) {
            setBrowser('firefox');
        } else if (userAgent.includes('Chrome')) {
            setBrowser('chrome');
        }
    }, []);

    useEffect(() => {
        let eventListener = null;
        if (isMotionActive && (browser === 'firefox' || permissionGranted)) {
            eventListener = (event) => {
                handleDeviceMotion(event);
            };
            window.addEventListener('devicemotion', eventListener);
        }

        return () => {
            if (eventListener) {
                window.removeEventListener('devicemotion', eventListener);
            }
        };
    }, [isMotionActive, permissionGranted, browser]);

    const handleStart = async () => {
        if (isPlaying) stop();
        if (browser === 'chrome' && isDeviceMotionSupported) {
            try {
                const permissionStatus = await DeviceMotionEvent.requestPermission();
                if (permissionStatus === 'granted') {
                    setPermissionGranted(true);
                    setIsMotionActive(true);
                } else {
                    alert('Permission to access motion sensors was denied.');
                }
            } catch (error) {
                console.error('Error requesting motion permission:', error);
            }
        } else if (browser === 'firefox') {
            setIsMotionActive(true);
        } else {
            alert('Device motion API is not supported on this device.');
        }
    };

    const handleStop = () => {
        if (isPlaying) stop();
        setIsMotionActive(false);
    };

    const handleDeviceMotion = (event) => {
        // get the acceleration data using fallback
        const accelerationData = event.acceleration || event.accelerationIncludingGravity;

        if (!accelerationData) {
            console.error("No acceleration data available from event!", event);
            setMotionData({ x: 0, y: 0, z: 0 });
            return;
        }

        let { x, y, z } = accelerationData;
        if (!x && !y && !z) {
            console.error("Acceleration data is not valid!", accelerationData);
            setMotionData({ x: 0, y: 0, z: 0 });
            return;
        }

        // Log the raw data
        console.log('Raw acceleration data: ', { x, y, z }, event);

        // If firefox we need to handle data differently
        if (browser === 'firefox' && event.accelerationIncludingGravity) {
            const gravity = 9.81;
            x = x - (event.accelerationIncludingGravity.x / (Math.sqrt(Math.pow(event.accelerationIncludingGravity.x, 2) + Math.pow(event.accelerationIncludingGravity.y, 2) + Math.pow(event.accelerationIncludingGravity.z, 2))) * gravity);
            y = y - (event.accelerationIncludingGravity.y / (Math.sqrt(Math.pow(event.accelerationIncludingGravity.x, 2) + Math.pow(event.accelerationIncludingGravity.y, 2) + Math.pow(event.accelerationIncludingGravity.z, 2))) * gravity);
            z = z - (event.accelerationIncludingGravity.z / (Math.sqrt(Math.pow(event.accelerationIncludingGravity.x, 2) + Math.pow(event.accelerationIncludingGravity.y, 2) + Math.pow(event.accelerationIncludingGravity.z, 2))) * gravity);
        }

        const { initialBias, previousAcceleration, isFlipping } = motionRef.current;
        if (!previousAcceleration) {
            motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
            return;
        }

        if (initialBias.x === 0 && initialBias.y === 0 && initialBias.z === 0) {
            motionRef.current = { ...motionRef.current, initialBias: { x, y, z } };
            return;
        }

        const thresholdX = 10;
        const thresholdY = 10;
        const thresholdZ = 10;

        const isFastMotion =
            Math.abs((x - initialBias.x) - (previousAcceleration.x - initialBias.x)) > thresholdX ||
            Math.abs((y - initialBias.y) - (previousAcceleration.y - initialBias.y)) > thresholdY ||
            Math.abs((z - initialBias.z) - (previousAcceleration.z - initialBias.z)) > thresholdZ;

        if (isFastMotion && !isFlipping) {
            motionRef.current = { ...motionRef.current, isFlipping: true };
            play();
            setTimeout(() => {
                motionRef.current = { ...motionRef.current, isFlipping: false };
            }, 500);
        }

        setMotionData({ x, y, z });
        motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
    };

    return (
        <div className="app-container">
            <h1>Motion Sound Trigger</h1>
            {!isMotionActive ? (
                <button onClick={handleStart} className="action-button">
                    Start Motion Detection
                </button>
            ) : (
                <button onClick={handleStop} className="action-button">
                    Stop Motion Detection
                </button>
            )}
            <div className="motion-data">
                <p>X: {motionData.x?.toFixed(2) ?? 0}</p>
                <p>Y: {motionData.y?.toFixed(2) ?? 0}</p>
                <p>Z: {motionData.z?.toFixed(2) ?? 0}</p>
            </div>
        </div>
    );
}

export default App;