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
    // State variable to store the username entered by the player.
    const [username, setUsername] = useState('');
    // State variable to track whether device motion detection is active.
    const [isMotionActive, setIsMotionActive] = useState(false);
    // Custom hook from 'use-sound' to handle playing the flip sound.
    // 'play' is the function to trigger the sound.
    // 'stop' is the function to stop the sound.
    // 'isPlaying' is a boolean indicating if the sound is currently playing.
    // 'load' is a function to preload the sound, used here to ensure the sound is ready when played.
    const [play, { stop, isPlaying, load }] = useSound(flipSound, {
        // This 'onplay' callback is executed when the 'play' function is called.
        // It immediately calls 'load' to ensure the sound is ready for subsequent plays.
        onplay: () => {
            load();
        },
    });
    // useRef hook to create a persistent reference to an object that holds motion-related data.
    // This ref is used to store values that shouldn't cause re-renders when updated,
    // such as the previous acceleration values and the flipping state.
    const motionRef = useRef({
        previousAcceleration: null, // Stores the acceleration data from the previous frame.
        isFlipping: false,         // A flag to prevent multiple score updates during a single flip.
        initialBias: { x: 0, y: 0, z: 0 }, // Stores the initial acceleration bias to calibrate motion detection.
    });
    // State variable to hold the latest device motion data.
    const [motionData, setMotionData] = useState({ x: 0, y: 0, z: 0, alpha: 0, beta: 0, gamma: 0 });
    // State variable to store the browser name (used for browser-specific adjustments).
    const [browser, setBrowser] = useState('');
    // State variable to indicate if the Device Motion API is supported by the browser.
    const [isDeviceMotionSupported, setIsDeviceMotionSupported] = useState(false);
    // State variable to store the player's current score.
    const [score, setScore] = useState(0);
    // State variable to store the highest score achieved by the player (persisted in local storage).
    const [highScore, setHighScore] = useState(0);
    // State variable to store the magnitude of the last detected flip.
    const [lastFlipMagnitude, setLastFlipMagnitude] = useState(0);
    // State variable to control the sensitivity of the motion detection.
    const [sensitivity, setSensitivity] = useState(1);
    // State variable to indicate if the game is currently in a cooldown period after a flip.
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    // Constant defining the duration of the cooldown period after a flip (in milliseconds).
    const coolDownDuration = 300;
    // State variable to track if the game is currently active.
    const [isGameActive, setIsGameActive] = useState(false);
    // State variable to track the remaining time in the current game.
    const [timeLeft, setTimeLeft] = useState(10);
    // State variable to manage the animation of the score increase.
    const [scoreAnimation, setScoreAnimation] = useState(null);
    // State variable to indicate if the game is over.
    const [isGameOver, setIsGameOver] = useState(false);
    // State variable to control the visibility of the tutorial modal.
    const [showTutorial, setShowTutorial] = useState(false);
    // State variable to manage the current score multiplier based on the flip streak.
    const [scoreMultiplier, setScoreMultiplier] = useState(1);
    // State variable to track the current streak of successful flips.
    const [flipStreak, setFlipStreak] = useState(0);
    // State variable to trigger the visual flip animation.
    const [isFlippingAnimation, setIsFlippingAnimation] = useState(false);
    // State variable to store the scoreboard data fetched from Supabase.
    const [scoreboard, setScoreboard] = useState([]);
    // State variable to indicate if the scoreboard data is currently being loaded.
    const [isScoreboardLoading, setIsScoreboardLoading] = useState(false);

    // useEffect hook that runs once when the component mounts.
    useEffect(() => {
        // Check if the Device Motion API is supported by the browser.
        setIsDeviceMotionSupported(typeof DeviceMotionEvent !== 'undefined');
        // Determine the browser name based on the user agent string.
        const userAgent = navigator.userAgent;
        setBrowser(userAgent.includes('Firefox') ? 'firefox' : 'chrome');

        // Retrieve the high score from local storage, if it exists.
        const storedHighScore = localStorage.getItem('highScore');
        if (storedHighScore) {
            setHighScore(parseInt(storedHighScore, 10));
        }
    }, []); // Empty dependency array ensures this effect runs only once.

    // useEffect hook that manages the device motion event listener.
    useEffect(() => {
        let eventListener = null;
        // Add the event listener only if motion detection is active and the game is running.
        if (isMotionActive && isGameActive) {
            eventListener = (event) => {
                handleDeviceMotion(event);
            };
            window.addEventListener('devicemotion', eventListener);
        }
        // Cleanup function to remove the event listener when the effect is unmounted or dependencies change.
        return () => {
            if (eventListener) {
                window.removeEventListener('devicemotion', eventListener);
            }
        };
    }, [isMotionActive, isGameActive, browser]); // Re-run the effect if any of these dependencies change.

    // useEffect hook that manages the game timer.
    useEffect(() => {
        let timer;
        // Start the timer if the game is active and there is time left.
        if (isGameActive && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prevTime => prevTime - 1);
            }, 1000); // Decrease timeLeft by 1 every second.
        } else if (timeLeft === 0 && isGameActive) {
            // End the game when the timer reaches 0.
            setIsGameActive(false);
            setIsMotionActive(false);
            setIsGameOver(true);
        }
        // Cleanup function to clear the interval when the effect is unmounted or dependencies change.
        return () => clearInterval(timer);
    }, [isGameActive, timeLeft]); // Re-run the effect if the game state or time left changes.

    // useEffect hook to update the high score when the current score exceeds it.
    useEffect(() => {
        if (score > highScore) {
            setHighScore(score);
            localStorage.setItem('highScore', score); // Persist the new high score in local storage.
        }
    }, [score, highScore]); // Re-run the effect when the score or high score changes.

    // useEffect hook to handle saving the score to the scoreboard when the game is over.
    useEffect(() => {
        if (isGameOver) {
            // Asynchronously update the scoreboard.
            const updateScoreboard = async () => {
                setIsScoreboardLoading(true);
                try {
                    // Save the score if a username is entered.
                    if (username.trim()) {
                        await saveScore();
                    }
                    // Fetch the updated scoreboard.
                    await fetchScoreboard();
                } catch (error) {
                    console.error("Error updating scoreboard:", error);
                } finally {
                    setIsScoreboardLoading(false);
                }
            };
            updateScoreboard();
        }
    }, [isGameOver, username, score]); // Re-run the effect when the game over state, username, or score changes.

    // Asynchronous function to fetch the top scores from the Supabase database.
    const fetchScoreboard = async () => {
        const { data, error } = await supabase
            .from('scores') // Specify the table name.
            .select('username, score, created_at') // Select the columns to retrieve.
            .order('score', { ascending: false }) // Order the results by score in descending order.
            .limit(15); // Limit the number of results to 15.

        if (error) {
            console.error('Error fetching scoreboard:', error);
        } else {
            setScoreboard(data); // Update the scoreboard state with the fetched data.
        }
    };

    // Asynchronous function to save the player's score to the Supabase database.
    const saveScore = async () => {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
            console.warn("Username is empty, skipping score save.");
            return;
        }

        console.log("saveScore function called", { username: trimmedUsername, score });

        // Check if a score already exists for the given username.
        const { data: existingScoreData, error: existingScoreError } = await supabase
            .from('scores')
            .select('score')
            .eq('username', trimmedUsername)
            .single(); // Expect only one matching row.

        console.log("Existing score data:", existingScoreData, "Error:", existingScoreError);

        if (existingScoreError && existingScoreError.code !== 'PGRST116') {
            // If there's an error other than "no data found", log it.
            console.error("Error checking for existing score:", existingScoreError);
            return;
        }

        if (existingScoreData) {
            // If a score exists, update it only if the current score is higher.
            if (score > existingScoreData.score) {
                console.log("Current score:", score, "Existing score:", existingScoreData.score, "Updating score...");
                const { data: updateData, error: updateError } = await supabase
                    .from('scores')
                    .update({ score: score, created_at: new Date() }) // Update the score and timestamp.
                    .eq('username', trimmedUsername); // Specify the row to update.

                if (updateError) {
                    console.error("Error updating score:", updateError);
                } else {
                    console.log("Score updated successfully (no data returned by update)");

                    // Verify the update by fetching the score again.
                    const { data: updatedScoreData, error: updatedScoreError } = await supabase
                        .from('scores')
                        .select('score')
                        .eq('username', trimmedUsername)
                        .single();

                    if (updatedScoreError) {
                        console.error("Error fetching updated score:", updatedScoreError);
                    } else if (updatedScoreData) {
                        console.log("Verified updated score:", updatedScoreData.score);
                    }
                }
            } else {
                console.log(`Current score ${score} is not higher than existing score ${existingScoreData.score} for user ${trimmedUsername}.`);
            }
        } else {
            // If no score exists for the username, insert a new record.
            console.log("No existing score found, inserting new score.");
            const { error: insertError } = await supabase
                .from('scores')
                .insert([{ username: trimmedUsername, score: score, created_at: new Date() }]);

            if (insertError) {
                console.error("Error saving new score:", insertError);
            } else {
                console.log(`Saved new score for user ${trimmedUsername}: ${score}`);
            }
        }
    };

    // Asynchronous function to handle the start game action.
    const handleStartGame = async () => {
        if (!username.trim()) {
            alert('Please enter a username.');
            return;
        }
        if (!isDeviceMotionSupported) {
            alert('Device motion API is not supported on this device.');
            return;
        }
        // Request permission to access device motion sensors on iOS 13+ and some Android browsers.
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permissionState = await DeviceMotionEvent.requestPermission();
                if (permissionState === 'granted') {
                    startGame(); // Start the game if permission is granted.
                } else {
                    alert('Device motion permission not granted.');
                }
            } catch (error) {
                console.error("Error requesting device motion permission:", error);
                alert('Could not get device motion permission.');
            }
        } else {
            startGame(); // Start the game directly if permission is not required.
        }
    };

    // Function to initialize the game state.
    const startGame = () => {
        setIsMotionActive(true);
        setIsGameActive(true);
        setIsGameOver(false);
        setTimeLeft(10);
        setScore(0);
        setScoreMultiplier(1);
        setFlipStreak(0);
        // Reset the initial bias when starting a new game.
        motionRef.current = { ...motionRef.current, initialBias: { x: 0, y: 0, z: 0 } };
    };

    // Function to reset the game state.
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
        // Reset the motion ref to its initial state.
        motionRef.current = {
            previousAcceleration: null,
            isFlipping: false,
            initialBias: { x: 0, y: 0, z: 0 },
        };
    };

    // useCallback hook to memoize the handleDeviceMotion function.
    // This prevents unnecessary re-renders of components that depend on this function.
    const handleDeviceMotion = useCallback((event) => {
        // Do nothing if the game is cooling down or not active.
        if (isCoolingDown || !isGameActive) {
            return;
        }

        let accelerationData;
        let rotationRateData;

        // Get acceleration data, handling Firefox's different property.
        if (event.acceleration) {
            accelerationData = browser === 'firefox' ? event.accelerationIncludingGravity : event.acceleration;
        }

        // Get rotation rate data.
        if (event.rotationRate) {
            rotationRateData = event.rotationRate;
        }

        // If no valid acceleration data is available, log an error and reset motion data.
        if (!accelerationData || (!accelerationData.x && !accelerationData.y && !accelerationData.z)) {
            console.error("No valid acceleration data available.");
            setMotionData(prev => ({ ...prev, x: 0, y: 0, z: 0 }));
            return;
        }

        // If no valid rotation rate data is available, log an error.
        if (!rotationRateData || (!rotationRateData.alpha && !rotationRateData.beta && !rotationRateData.gamma)) {
            console.error("No valid rotation rate data available.");
            return;
        }

        // Extract acceleration and rotation data.
        let { x, y, z } = accelerationData;
        let { alpha, beta, gamma } = rotationRateData;

        // Define a threshold for detecting fast rotation.
        const isRotatingFast = Math.abs(alpha) > 100 || Math.abs(beta) > 100 || Math.abs(gamma) > 100;

        // Get relevant data from the motion ref.
        const { initialBias, previousAcceleration, isFlipping } = motionRef.current;

        // Store the initial acceleration as the previous acceleration for the first frame.
        if (!previousAcceleration) {
            motionRef.current = { ...motionRef.current, previousAcceleration: { x, y, z } };
            return;
        }

        // Set the initial bias based on the first valid acceleration data.
        if (initialBias.x === 0 && initialBias.y === 0 && initialBias.z === 0) {
            motionRef.current = { ...motionRef.current, initialBias: { x, y: 0, z: 0 } };
            return;
        }

        // Define base thresholds for motion detection, adjusted for browser differences.
        const baseThresholdChrome = 10;
        const baseThresholdFirefox = 8;
        const baseThreshold = browser === 'chrome' ? baseThresholdChrome : baseThresholdFirefox;

        // Apply sensitivity to the thresholds.
        const thresholdX = baseThreshold * sensitivity;
        const thresholdY = baseThreshold * sensitivity;
        const thresholdZ = baseThreshold * sensitivity;

        // Calculate the change in acceleration since the last frame, relative to the initial bias.
        const deltaX = (x - initialBias.x) - (previousAcceleration.x - initialBias.x);
        const deltaY = (y - initialBias.y) - (previousAcceleration.y - initialBias.y);
        const deltaZ = (z - initialBias.z) - (previousAcceleration.z - initialBias.z);

        // Determine if there was a fast motion event.
        const isFastMotion =
            Math.abs(deltaX) > thresholdX ||
            Math.abs(deltaY) > thresholdY ||
            Math.abs(deltaZ) > thresholdZ;

        // Minimum magnitude for a valid flip and threshold for dominant axis detection.
        const minFlipMagnitude = 5;
        const dominantAxisThreshold = 0.7;

        // Detect a flip if there's fast motion, it's not already flipping, and the device is rotating fast.
        if (isFastMotion && !isFlipping && isRotatingFast) {
            // Calculate the magnitude of the acceleration change.
            const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

            // Determine the absolute values of the deltas and their sum.
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            const absDeltaZ = Math.abs(deltaZ);
            const sumAbsDeltas = absDeltaX + absDeltaY + absDeltaZ;

            // Check if the motion is predominantly along one axis.
            const isDominantAxisMotion = sumAbsDeltas > 0 &&
                (absDeltaX / sumAbsDeltas > dominantAxisThreshold ||
                 absDeltaY / sumAbsDeltas > dominantAxisThreshold ||
                 absDeltaZ / sumAbsDeltas > dominantAxisThreshold);

            // If the magnitude is above the minimum and it's a dominant axis motion, consider it a valid flip.
            if (magnitude > minFlipMagnitude && isDominantAxisMotion) {
                // Set the flipping flag to prevent multiple triggers.
                motionRef.current = { ...motionRef.current, isFlipping: true };
                play(); // Play the flip sound.
                setIsFlippingAnimation(true); // Start the flip animation.
                setTimeout(() => setIsFlippingAnimation(false), 200); // Stop the animation after a short delay.

                // Increase the flip streak and update the score multiplier.
                setFlipStreak(prevStreak => prevStreak + 1);
                setScoreMultiplier(Math.min(3, Math.floor(flipStreak / 3) + 1));

                // Calculate the score increment based on magnitude and multiplier.
                const scoreIncrement = Math.round(magnitude * scoreMultiplier);
                setScore(prevScore => {
                    // Trigger the score animation.
                    setScoreAnimation({
                        value: scoreIncrement,
                        timestamp: Date.now()
                    });
                    return prevScore + scoreIncrement;
                });
                setLastFlipMagnitude(magnitude); // Store the magnitude of the flip.

                // Trigger device vibration if supported.
                if (typeof navigator.vibrate === 'function') {
                    navigator.vibrate(50);
                }

                // Enter a cooldown period after a successful flip.
                setIsCoolingDown(true);
                setTimeout(() => {
                    motionRef.current = { ...motionRef.current, isFlipping: false };
                    setIsCoolingDown(false);
                }, coolDownDuration);
            } else {
                // Reset streak and multiplier if the flip was not valid.
                setFlipStreak(0);
                setScoreMultiplier(1);
            }
        }

        // Update the motion data state for display.
        setMotionData({ x, y, z, alpha, beta, gamma });
        // Store the current acceleration as the previous acceleration for the next frame.
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
                        {/* Display the score increase animation */}
                        {scoreAnimation && (
                            <span className="score-animation">+{scoreAnimation.value}</span>
                        )}
                    </span>
                    {/* Display the score multiplier if it's greater than 1 */}
                    {scoreMultiplier > 1 && <span className="multiplier">x{scoreMultiplier}</span>}
                    {/* Display a fire emoji for a flip streak */}
                    {flipStreak > 2 && <span className="streak">🔥</span>}
                </div>
            </div>

            {/* Input and start button when the game is not active and not over */}
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

            {/* Display the timer when the game is active */}
            {isGameActive && (
                <div className="game-controls">
                    <div className="timer">Time Left: {timeLeft}s</div>
                </div>
            )}

            {/* Game over screen */}
            {isGameOver && (
                <div>
                    <h2>Game Over!</h2>
                    <p>Your Score: {score}</p>
                    <h3>Top Scores</h3>
                    {/* Display loading message while fetching scores */}
                    {isScoreboardLoading ? (
                        <p>Loading scores...</p>
                    ) : (
                        <div className="scoreboard">
                            {/* Display the scoreboard if there are entries */}
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
                    {/* Button to try again */}
                    <button onClick={resetGame} className="action-button start-button">
                        <FaRedo /> Try Again
                    </button>
                </div>
            )}

            {/* Display motion data when the game is active (for debugging) */}
            {isGameActive && (
                <div className="motion-data">
                    <p>X: {motionData.x?.toFixed(2) ?? 0}</p>
                    <p>Y: {motionData.y?.toFixed(2) ?? 0}</p>
                    <p>Z: {motionData.z?.toFixed(2) ?? 0}</p>
                    <p>α (Rotation Z): {motionData.alpha?.toFixed(2) ?? 0}</p>
                    <p>β (Rotation X): {motionData.beta?.toFixed(2) ?? 0}</p>
                    <p>γ (Rotation Y): {motionData.gamma?.toFixed(2) ?? 0}</p>
                </div>
            )}
            {/* Display the magnitude of the last flip */}
            <div className="last-flip">
                {lastFlipMagnitude > 0 && <p>Last Flip Magnitude: {lastFlipMagnitude.toFixed(2)}</p>}
            </div>
            {/* Sensitivity control when the game is not active or over */}
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

            {/* Help button to show the tutorial */}
            {!isGameActive && !isGameOver && (
                <button onClick={() => setShowTutorial(true)} className="action-button help-button">
                    <FaQuestionCircle /> How to Play
                </button>
            )}

            {/* Tutorial modal */}
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

            {/* Visual animation when a flip is detected */}
            {isFlippingAnimation && <div className="flip-animation"></div>}
        </div>
    );
}

export default App;