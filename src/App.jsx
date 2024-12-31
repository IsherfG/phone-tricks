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
    const [isDeviceMotionSupported, setIsDeviceMotionSupported] = useState(false);
    const [score, setScore] = useState(0);
    const [lastFlipMagnitude, setLastFlipMagnitude] = useState(0);

    useEffect(() => {
        // Check if DeviceMotionEvent is supported
        setIsDeviceMotionSupported(
            typeof DeviceMotionEvent !== 'undefined'
        );

        // Get the browser info
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Firefox')) {
            setBrowser('firefox');
        } else {
            setBrowser('chrome');
        }
    }, []);

    useEffect(() => {
        let eventListener = null;
        if (isMotionActive) {
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
    }, [isMotionActive, browser]);

    const handleStart = () => {
      console.log("handleStart function called!");
        if (isPlaying) stop();

        if (!isDeviceMotionSupported) {
            alert('Device motion API is not supported on this device.');
            return;
        }

        // Request permission for iOS 13+ and some other browsers
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        setIsMotionActive(true);
                        motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
                        console.log("Device motion permission granted!");
                    } else {
                        alert('Device motion permission not granted.');
                        console.log("Device motion permission denied.");
                    }
                })
                .catch(error => {
                    console.error("Error requesting device motion permission:", error);
                });
        } else {
            // No permission request needed or not supported, just start
            setIsMotionActive(true);
            motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
            console.log("Device motion permission request not needed or supported.");
        }
    };

    const handleStop = () => {
        if (isPlaying) stop();
        setIsMotionActive(false);
        setScore(0);
        setLastFlipMagnitude(0);
        motionRef.current = {
            previousAcceleration: null,
            isFlipping: false,
            initialBias: { x: 0, y: 0, z: 0 },
        };
    };

    const handleDeviceMotion = (event) => {
        let x, y, z;

        // Helper function to safely get acceleration data
        const getAcceleration = (evt) => {
            return {
                x: evt.acceleration?.x || evt.accelerationIncludingGravity?.x || 0,
                y: evt.acceleration?.y || evt.accelerationIncludingGravity?.y || 0,
                z: evt.acceleration?.z || evt.accelerationIncludingGravity?.z || 0,
            };
        };

        const accelerationData = getAcceleration(event);
        x = accelerationData.x;
        y = accelerationData.y;
        z = accelerationData.z;

        if (!x && !y && !z) {
            console.error("No valid acceleration data available.");
            setMotionData({ x: 0, y: 0, z: 0 });
            return;
        }

        // Handle Firefox's acceleration
        if (browser === 'firefox' && event.acceleration) {
            x = event.acceleration.x;
            y = event.acceleration.y;
            z = event.acceleration.z;
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

        const thresholdX = 0.7;
        const thresholdY = 0.7;
        const thresholdZ = 0.7;

        const deltaX = x - previousAcceleration.x;
        const deltaY = y - previousAcceleration.y;
        const deltaZ = z - previousAcceleration.z;

        const isFastMotion =
            Math.abs(deltaX) > thresholdX ||
            Math.abs(deltaY) > thresholdY ||
            Math.abs(deltaZ) > thresholdZ;

        if (isFastMotion && !isFlipping) {
            motionRef.current = { ...motionRef.current, isFlipping: true };
            play();

            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
            setLastFlipMagnitude(magnitude);

            const scoreIncrement = Math.round(magnitude * 10);
            setScore(prevScore => prevScore + scoreIncrement);

            setTimeout(() => {
                motionRef.current = { ...motionRef.current, isFlipping: false };
            }, 500);
        }

        setMotionData({ x, y, z });
        motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
    };

    return (
        <div className="app-container">
            <div className="header">
                <h1>Flip It!</h1>
                <div className="score-container">
                    <span>Score: </span>
                    <span className="score">{score}</span>
                </div>
            </div>

            {!isMotionActive ? (
                <button onClick={handleStart} className="action-button start-button">
                    Start Motion Detection
                </button>
            ) : (
                <button onClick={handleStop} className="action-button stop-button">
                    Stop Motion Detection
                </button>
            )}
            <div className="motion-data">
                <p>X: {motionData.x?.toFixed(2) ?? 0}</p>
                <p>Y: {motionData.y?.toFixed(2) ?? 0}</p>
                <p>Z: {motionData.z?.toFixed(2) ?? 0}</p>
            </div>
            <div className="last-flip">
                {lastFlipMagnitude > 0 && <p>Last Flip Magnitude: {lastFlipMagnitude.toFixed(2)}</p>}
            </div>
        </div>
    );
}

export default App;