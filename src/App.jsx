import React, { useState, useEffect, useRef, useCallback } from 'react';
import useSound from 'use-sound';
import { FaPlay, FaRedo, FaQuestionCircle } from 'react-icons/fa';
import flipSound from './assets/flip.mp3';
import './App.css';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function App() {
    const [username, setUsername] = useState('');
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
    const [isGameOver, setIsGameOver] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [scoreMultiplier, setScoreMultiplier] = useState(1);
    const [flipStreak, setFlipStreak] = useState(0);
    const [isFlippingAnimation, setIsFlippingAnimation] = useState(false);
    const [scoreboard, setScoreboard] = useState([]);
    const [isScoreboardLoading, setIsScoreboardLoading] = useState(false);

    useEffect(() => {
        setIsDeviceMotionSupported(typeof DeviceMotionEvent !== 'undefined');
        const userAgent = navigator.userAgent;
        setBrowser(userAgent.includes('Firefox') ? 'firefox' : 'chrome');

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
        } else if (timeLeft === 0 && isGameActive) {
            setIsGameActive(false);
            setIsMotionActive(false);
            setIsGameOver(true);
        }
        return () => clearInterval(timer);
    }, [isGameActive, timeLeft]);

    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('highScore', score);
        }
    }, [score, highScore]);

    useEffect(() => {
        if (isGameOver) {
            const updateScoreboard = async () => {
                setIsScoreboardLoading(true);
                try {
                    if (username.trim()) {
                        await saveScore();
                    }
                    await fetchScoreboard();
                } catch (error) {
                    console.error("Error updating scoreboard:", error);
                    // Handle error, maybe show a message to the user
                } finally {
                    setIsScoreboardLoading(false);
                }
            };
            updateScoreboard();
        }
    }, [isGameOver, username, score]);

    const fetchScoreboard = async () => {
        const { data, error } = await supabase
            .from('scores')
            .select('username, score, created_at')
            .order('score', { ascending: false })
            .limit(15);

        if (error) {
            console.error('Error fetching scoreboard:', error);
        } else {
            setScoreboard(data);
        }
    };

    const saveScore = async () => {
        const { data, error } = await supabase
            .from('scores')
            .upsert(
                [{ username: username.trim(), score: score, created_at: new Date() }],
                { onConflict: 'username' }
            );

        if (error) {
            console.error('Error saving or updating score:', error);
        } else {
            console.log('Score saved or updated successfully:', data);
        }
    };

    const handleStartGame = async () => {
        if (!username.trim()) {
            alert('Please enter a username.');
            return;
        }
        if (!isDeviceMotionSupported) {
            alert('Device motion API is not supported on this device.');
            return;
        }
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            const permissionState = await DeviceMotionEvent.requestPermission();
            if (permissionState === 'granted') {
                startGame();
            } else {
                alert('Device motion permission not granted.');
            }
        } else {
            startGame();
        }
    };

    const startGame = () => {
        setIsMotionActive(true);
        setIsGameActive(true);
        setIsGameOver(false);
        setTimeLeft(10);
        setScore(0);
        setScoreMultiplier(1);
        setFlipStreak(0);
        motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
    };

    const resetGame = () => {
        setIsGameActive(false);
        setIsMotionActive(false);
        setIsGameOver(false);
        setTimeLeft(10);
        setScore(0);
        setScoreMultiplier(1);
        setFlipStreak(0);
        setLastFlipMagnitude(0);
        setScoreAnimation(null);
        setIsFlippingAnimation(false);
        setScoreboard([]);
        motionRef.current = {
            previousAcceleration: null,
            isFlipping: false,
            initialBias: { x: 0, y: 0, z: 0 },
        };
    };

    const handleDeviceMotion = useCallback((event) => {
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

        const baseThresholdChrome = 10; // Increased threshold for Chrome
        const baseThresholdFirefox = 8;
        const baseThreshold = browser === 'chrome' ? baseThresholdChrome : baseThresholdFirefox;

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
        const dominantAxisThresholdChrome = 0.7; // More restrictive for Chrome
        const dominantAxisThresholdFirefox = 0.8;
        const dominantAxisThreshold = browser === 'chrome' ? dominantAxisThresholdChrome : dominantAxisThresholdFirefox;

        if (isFastMotion && !isFlipping) {
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

            const isDominantAxisMotion = browser === 'chrome' &&
                (Math.abs(deltaX) > magnitude * dominantAxisThreshold ||
                 Math.abs(deltaY) > magnitude * dominantAxisThreshold ||
                 Math.abs(deltaZ) > magnitude * dominantAxisThreshold);

            if (magnitude > minFlipMagnitude && !isDominantAxisMotion) {
                motionRef.current = { ...motionRef.current, isFlipping: true };
                play();
                setIsFlippingAnimation(true);
                setTimeout(() => setIsFlippingAnimation(false), 200);

                setFlipStreak(prevStreak => prevStreak + 1);
                setScoreMultiplier(Math.min(3, Math.floor(flipStreak / 3) + 1));

                const scoreIncrement = Math.round(magnitude * scoreMultiplier);
                setScore(prevScore => {
                    setScoreAnimation({
                        value: scoreIncrement,
                        timestamp: Date.now()
                    });
                    return prevScore + scoreIncrement;
                });
                setLastFlipMagnitude(magnitude);

                if (typeof navigator.vibrate === 'function') {
                    navigator.vibrate(50);
                }

                setIsCoolingDown(true);
                setTimeout(() => {
                    motionRef.current = { ...motionRef.current, isFlipping: false };
                    setIsCoolingDown(false);
                }, coolDownDuration);
            } else {
                setFlipStreak(0);
                setScoreMultiplier(1);
            }
        }

        setMotionData({ x, y, z });
        motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
    }, [browser, coolDownDuration, isCoolingDown, isGameActive, play, scoreMultiplier, sensitivity, flipStreak]);

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
                    {scoreMultiplier > 1 && <span className="multiplier">x{scoreMultiplier}</span>}
                    {flipStreak > 2 && <span className="streak">🔥</span>}
                </div>
            </div>

            {!isGameActive && !isGameOver && (
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="username-input"
                    />
                    <button onClick={handleStartGame} className="action-button start-button">
                        <FaPlay /> Start Game
                    </button>
                </div>
            )}

            {isGameActive && (
                <div className="game-controls">
                    <div className="timer">Time Left: {timeLeft}s</div>
                </div>
            )}

            {isGameOver && (
                <div>
                    <h2>Game Over!</h2>
                    <p>Your Score: {score}</p>
                    <h3>Top Scores</h3>
                    {isScoreboardLoading ? (
                        <p>Loading scores...</p>
                    ) : (
                        <div className="scoreboard">
                            {scoreboard.length > 0 ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Username</th>
                                            <th>Score</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scoreboard.map((entry, index) => (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>{entry.username}</td>
                                                <td>{entry.score}</td>
                                                <td>
                                                    {new Date(entry.created_at).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>No scores yet!</p>
                            )}
                        </div>
                    )}
                    <button onClick={resetGame} className="action-button start-button">
                        <FaRedo /> Try Again
                    </button>
                </div>
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
            {!isGameActive && !isGameOver && (
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

            {!isGameActive && !isGameOver && (
                <button onClick={() => setShowTutorial(true)} className="action-button help-button">
                    <FaQuestionCircle /> How to Play
                </button>
            )}

            {showTutorial && (
                <div className="tutorial-modal">
                    <div className="tutorial-content">
                        <h2>How to Play Flip It!</h2>
                        <p>Flip your device in the air to score points.</p>
                        <p>The faster and cleaner the flip, the more points you get.</p>
                        <p>Build up a streak of successful flips for a score multiplier!</p>
                        <button onClick={() => setShowTutorial(false)} className="action-button">
                            Got it!
                        </button>
                    </div>
                </div>
            )}

            {isFlippingAnimation && <div className="flip-animation"></div>}
        </div>
    );
}

export default App;