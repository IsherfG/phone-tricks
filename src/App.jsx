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
    const [highScore, setHighScore] = useState(0);
    const [lastFlipMagnitude, setLastFlipMagnitude] = useState(0);
    const [sensitivity, setSensitivity] = useState(1);
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const coolDownDuration = 300;
    const [isGameActive, setIsGameActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(10);
    const [scoreAnimation, setScoreAnimation] = useState(null);

    useEffect(() => {
        setIsDeviceMotionSupported(typeof DeviceMotionEvent !== 'undefined');
        const userAgent = navigator.userAgent;
        setBrowser(userAgent.includes('Firefox') ? 'firefox' : 'chrome');

        // Load high score from local storage
        const storedHighScore = localStorage.getItem('highScore');
        if (storedHighScore) {
            setHighScore(parseInt(storedHighScore, 10));
        }
    }, []);

    useEffect(() => {
        let eventListener = null;
        if (isMotionActive && isGameActive) {
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
    }, [isMotionActive, isGameActive, browser]);

    useEffect(() => {
        let timer;
        if (isGameActive && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prevTime => prevTime - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsGameActive(false);
            setIsMotionActive(false);
        }
        return () => clearInterval(timer);
    }, [isGameActive, timeLeft]);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('highScore', score);
        }
    }, [score, highScore]);

    const handleStartGame = () => {
        if (!isDeviceMotionSupported) {
            alert('Device motion API is not supported on this device.');
            return;
        }
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        setIsMotionActive(true);
                        setIsGameActive(true);
                        setTimeLeft(10);
                        setScore(0);
                        motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
                    } else {
                        alert('Device motion permission not granted.');
                    }
                })
                .catch(console.error);
        } else {
            setIsMotionActive(true);
            setIsGameActive(true);
            setTimeLeft(10);
            setScore(0);
            motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
        }
    };

    const handleStop = () => {
        if (isPlaying) stop();
        setIsMotionActive(false);
        setIsGameActive(false);
        setTimeLeft(10);
    };

    const handleDeviceMotion = (event) => {
        if (isCoolingDown || !isGameActive) {
            return;
        }

        let accelerationData;
        if (browser === 'chrome') {
            accelerationData = event.acceleration;
        } else if (browser === 'firefox') {
            accelerationData = event.accelerationIncludingGravity;
        }

        if (!accelerationData || (!accelerationData.x && !accelerationData.y && !accelerationData.z)) {
            console.error("No valid acceleration data available.");
            setMotionData({ x: 0, y: 0, z: 0 });
            return;
        }

        let { x, y, z } = accelerationData;

        if (browser === 'firefox' && event.accelerationIncludingGravity) {
            const gravity = 9.81;
            const norm = Math.sqrt(
                Math.pow(event.accelerationIncludingGravity.x, 2) +
                Math.pow(event.accelerationIncludingGravity.y, 2) +
                Math.pow(event.accelerationIncludingGravity.z, 2)
            );
            if (norm > 0) {
                x = accelerationData.x - (event.accelerationIncludingGravity.x / norm) * gravity;
                y = accelerationData.y - (event.accelerationIncludingGravity.y / norm) * gravity;
                z = accelerationData.z - (event.accelerationIncludingGravity.z / norm) * gravity;
            }
        } else if (browser === 'chrome' && event.acceleration) {
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
            motionRef.current = { ...motionRef.current, initialBias: { x, y: 0, z: 0 } };
            return;
        }

        const baseThreshold = 8;
        const thresholdX = baseThreshold * sensitivity;
        const thresholdY = baseThreshold * sensitivity;
        const thresholdZ = baseThreshold * sensitivity;

        const deltaX = (x - initialBias.x) - (previousAcceleration.x - initialBias.x);
        const deltaY = (y - initialBias.y) - (previousAcceleration.y - initialBias.y);
        const deltaZ = (z - initialBias.z) - (previousAcceleration.z - initialBias.z);

        const isFastMotion =
            Math.abs(deltaX) > thresholdX ||
            Math.abs(deltaY) > thresholdY ||
            Math.abs(deltaZ) > thresholdZ;

        const minFlipMagnitude = 5;

        if (isFastMotion && !isFlipping) {
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

            const isDominantAxisMotion = browser === 'chrome' &&
                (Math.abs(deltaX) > magnitude * 0.8 ||
                 Math.abs(deltaY) > magnitude * 0.8 ||
                 Math.abs(deltaZ) > magnitude * 0.8);

            if (magnitude > minFlipMagnitude && !isDominantAxisMotion) {
                motionRef.current = { ...motionRef.current, isFlipping: true };
                play();

                const scoreIncrement = Math.round(magnitude);
                setScore(prevScore => {
                    setScoreAnimation({
                        value: scoreIncrement,
                        timestamp: Date.now()
                    });
                    return prevScore + scoreIncrement;
                });
                setLastFlipMagnitude(magnitude);

                setIsCoolingDown(true);
                setTimeout(() => {
                    motionRef.current = { ...motionRef.current, isFlipping: false };
                    setIsCoolingDown(false);
                }, coolDownDuration);
            }
        }

        setMotionData({ x, y, z });
        motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
    };

    return (
        <div className="app-container">
            <div className="header">
                <div>
                    <h1>Flip It!</h1>
                    <div className="high-score-container">
                        <span>High Score: </span>
                        <span className="score">{highScore}</span>
                    </div>
                </div>
                <div className="score-container">
                    <span>Score: </span>
                    <span className={`score ${scoreAnimation ? 'animate' : ''}`}>
                        {score}
                        {scoreAnimation && (
                            <span className="score-animation">+{scoreAnimation.value}</span>
                        )}
                    </span>
                </div>
            </div>

            {!isGameActive ? (
                <button onClick={handleStartGame} className="action-button start-button">
                    Start Game
                </button>
            ) : (
                <div className="timer">Time Left: {timeLeft}s</div>
            )}
            {isGameActive && (
                <div className="motion-data">
                    <p>X: {motionData.x?.toFixed(2) ?? 0}</p>
                    <p>Y: {motionData.y?.toFixed(2) ?? 0}</p>
                    <p>Z: {motionData.z?.toFixed(2) ?? 0}</p>
                </div>
            )}
            <div className="last-flip">
                {lastFlipMagnitude > 0 && <p>Last Flip Magnitude: {lastFlipMagnitude.toFixed(2)}</p>}
            </div>
             {!isGameActive && (
                <div className="sensitivity-control">
                    <label htmlFor="sensitivity">Sensitivity:</label>
                    <input
                        type="range"
                        id="sensitivity"
                        min="0.1"
                        max="2"
                        step="0.05"
                        value={sensitivity}
                        onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                    />
                    <span className="sensitivity-value">{sensitivity.toFixed(2)}</span>
                </div>
            )}
        </div>
    );
}

export default App;