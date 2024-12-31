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
    const [score, setScore] = useState(0);
    const [lastFlipMagnitude, setLastFlipMagnitude] = useState(0); // store the magnitude of last flip

    useEffect(() => {
        // Check if DeviceMotionEvent is supported
        setIsDeviceMotionSupported(
            typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function'
        );

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
                console.log("Permission Status:", permissionStatus);
                if (permissionStatus === 'granted') {
                    setPermissionGranted(true);
                    setIsMotionActive(true);
                } else {
                    alert('Permission to access motion sensors was denied.');
                }
            } catch (error) {
                console.error('Error requesting motion permission:', error);
                alert('Error requesting motion permission. See console for details.');
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
        setScore(0); // Reset score when stopping
        setLastFlipMagnitude(0); // Reset lastFlipMagnitude
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


        if (browser === 'chrome') {
            console.log("Chrome Motion Event:", event);
            console.log("Chrome Acceleration:", event.acceleration);
            console.log("Chrome Acceleration Including Gravity:", event.accelerationIncludingGravity);
        }

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


        const deltaX = (x - initialBias.x) - (previousAcceleration.x - initialBias.x);
        const deltaY = (y - initialBias.y) - (previousAcceleration.y - initialBias.y);
        const deltaZ = (z - initialBias.z) - (previousAcceleration.z - initialBias.z);


        const isFastMotion =
            Math.abs(deltaX) > thresholdX ||
            Math.abs(deltaY) > thresholdY ||
            Math.abs(deltaZ) > thresholdZ;


        if (isFastMotion && !isFlipping) {
            motionRef.current = { ...motionRef.current, isFlipping: true };
            play();

            // Calculate the magnitude of the flip
             const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
            setLastFlipMagnitude(magnitude);

             // Add to score based on magnitude
             const scoreIncrement = Math.round(magnitude); // Scale or round as needed
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