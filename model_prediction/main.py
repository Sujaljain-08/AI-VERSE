"""
Main Application - Focus Monitoring System (OpenCV Version)
Works without PyTorch - uses OpenCV's DNN module and Haar Cascades
"""

import cv2
import numpy as np
import yaml
import logging
import time
import argparse
from pathlib import Path
from datetime import datetime
import os


class SimpleFocusMonitor:
    """
    Simplified focus monitoring using OpenCV only (no PyTorch required).
    """
    
    def __init__(self, config_path: str = "config.yaml"):
        """Initialize the focus monitoring system."""
        # Load configuration
        with open(config_path, 'r', encoding='utf-8') as f:
            self.config = yaml.safe_load(f)
        
        # Setup logging
        self._setup_logging()
        
        self.logger.info("=" * 60)
        self.logger.info("Focus Monitoring System - Starting (OpenCV Version)")
        self.logger.info("=" * 60)
        
        # Camera settings
        self.camera_source = self.config['camera']['source']
        self.camera_width = self.config['camera']['width']
        self.camera_height = self.config['camera']['height']
        
        # Display settings
        self.show_video = self.config['display']['show_video']
        self.window_name = self.config['display']['window_name']
        
        # Alert settings
        self.enable_audio = self.config['alerts']['enable_audio']
        self.cooldown_period = self.config['alerts']['cooldown_period']
        
        # Thresholds
        self.away_threshold = self.config['focus_tracking']['away_threshold']
        
        # Initialize face detector (Haar Cascade)
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # Initialize eye detector for gaze detection
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        
        # Initialize profile face detector (for looking away)
        self.profile_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_profileface.xml'
        )
        
        # Initialize camera
        self.cap = None
        self._initialize_camera()
        
        # State tracking
        self.current_state = "focused"
        self.face_missing_count = 0
        self.face_missing_threshold = int(30 * self.away_threshold)  # Frames
        self.looking_away_count = 0
        self.looking_away_threshold = int(30 * 2)  # 2 seconds of looking away
        self.looking_down_count = 0
        self.looking_down_threshold = int(30 * 3)  # 3 seconds looking down
        
        # Away from screen timer (5 seconds)
        self.away_timer = 0.0
        self.away_start_time = None
        self.away_warning_shown = False
        
        # Score tracking (0-100) - FAST response!
        self.focus_score = 100.0
        self.score_history = []
        self.max_score_history = 15  # Keep last 0.5 seconds - VERY responsive!
        
        # Statistics
        self.frame_count = 0
        self.start_time = time.time()
        self.focused_time = 0
        self.away_time = 0
        self.distracted_time = 0
        self.last_state_change = time.time()
        
        # Alert tracking
        self.last_alert_time = {}
        
        # Audio
        if self.enable_audio:
            self._initialize_audio()
        
        # Create snapshots directory
        if self.config['logging']['save_snapshots']:
            self.snapshots_dir = self.config['logging']['snapshots_dir']
            os.makedirs(self.snapshots_dir, exist_ok=True)
        
        self.logger.info("Focus Monitoring System initialized successfully")
    
    def _setup_logging(self):
        """Setup logging configuration."""
        log_config = self.config['logging']
        log_level = getattr(logging, log_config['log_level'])
        
        # Create logger
        self.logger = logging.getLogger()
        self.logger.setLevel(log_level)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_format = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)
        
        # File handler
        if log_config['enable_file_logging']:
            log_file = log_config['log_file']
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setLevel(log_level)
            file_handler.setFormatter(console_format)
            self.logger.addHandler(file_handler)
    
    def _initialize_camera(self):
        """Initialize camera capture."""
        self.logger.info(f"Opening camera: {self.camera_source}")
        
        self.cap = cv2.VideoCapture(self.camera_source)
        
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera: {self.camera_source}")
        
        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.camera_width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.camera_height)
        
        actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        self.logger.info(f"Camera opened: {actual_width}x{actual_height}")
    
    def _initialize_audio(self):
        """Initialize pygame for audio alerts."""
        try:
            import pygame
            pygame.mixer.init()
            self.audio_initialized = True
            self.logger.info("Audio alerts initialized")
        except Exception as e:
            self.logger.warning(f"Failed to initialize audio: {e}")
            self.enable_audio = False
            self.audio_initialized = False
    
    def _play_alert_sound(self, priority: str = "HIGH"):
        """Play audio alert."""
        if not self.enable_audio or not self.audio_initialized:
            return
        
        try:
            import pygame
            
            frequency = 1000 if priority == "HIGH" else 800
            duration = 500 if priority == "HIGH" else 300
            
            sample_rate = 22050
            n_samples = int(sample_rate * duration / 1000)
            t = np.linspace(0, duration / 1000, n_samples)
            wave = np.sin(2 * np.pi * frequency * t)
            
            # Fade
            fade_samples = int(sample_rate * 0.01)
            fade_in = np.linspace(0, 1, fade_samples)
            fade_out = np.linspace(1, 0, fade_samples)
            wave[:fade_samples] *= fade_in
            wave[-fade_samples:] *= fade_out
            
            wave = (wave * 32767).astype(np.int16)
            stereo_wave = np.column_stack((wave, wave))
            
            sound = pygame.sndarray.make_sound(stereo_wave)
            sound.play()
        except Exception as e:
            self.logger.error(f"Failed to play audio: {e}")
    
    def _can_trigger_alert(self, alert_type: str) -> bool:
        """Check if alert can be triggered based on cooldown."""
        current_time = time.time()
        
        if alert_type in self.last_alert_time:
            if current_time - self.last_alert_time[alert_type] < self.cooldown_period:
                return False
        
        self.last_alert_time[alert_type] = current_time
        return True
    
    def process_frame(self, frame: np.ndarray):
        """Process a single frame with score-based detection."""
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect frontal faces
        faces = self.face_cascade.detectMultiScale(
            gray, 
            scaleFactor=1.1,  # More sensitive
            minNeighbors=3,   # Lower threshold for better detection
            minSize=(30, 30)
        )
        
        # Detect profile faces (RIGHT side)
        profile_faces_right = self.profile_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,  # More sensitive
            minNeighbors=3,   # Lower threshold
            minSize=(30, 30)
        )
        
        # Detect profile faces (LEFT side) by flipping image
        gray_flipped = cv2.flip(gray, 1)
        profile_faces_left = self.profile_cascade.detectMultiScale(
            gray_flipped,
            scaleFactor=1.1,
            minNeighbors=3,
            minSize=(30, 30)
        )
        
        # Adjust left profile coordinates (since image was flipped)
        profile_faces_left_adjusted = []
        for (x, y, w, h) in profile_faces_left:
            x_adjusted = frame.shape[1] - x - w  # Mirror X coordinate
            profile_faces_left_adjusted.append((x_adjusted, y, w, h))
        
        # Calculate focus score for this frame
        frame_score = 0.0
        status_text = "Unknown"
        color = (128, 128, 128)
        new_state = "unknown"
        
        # Update state
        current_time = time.time()
        previous_state = self.current_state
        
        if len(faces) > 0:
            # Frontal face detected - calculate focus score
            face = faces[0]  # Use the first (largest) face
            x, y, w, h = face
            
            # Start with higher base score for face detection
            frame_score = 60.0  # Base score - face visible and frontal
            
            # Extract face region for eye detection
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = frame[y:y+h, x:x+w]
            
            # Detect eyes (more sensitive)
            eyes = self.eye_cascade.detectMultiScale(
                roi_gray,
                scaleFactor=1.05,  # More sensitive
                minNeighbors=3,    # Lower threshold for better detection
                minSize=(10, 10)   # Smaller minimum size
            )
            
            # Check for devices (phones/tablets) in hands
            device_detected = False
            lower_frame = gray[frame.shape[0]//2:, :]  # Bottom half of frame
            # Look for rectangular objects (potential phones/tablets)
            edges = cv2.Canny(lower_frame, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > 1000:  # Significant object
                    x_c, y_c, w_c, h_c = cv2.boundingRect(contour)
                    aspect_ratio = float(w_c) / h_c if h_c > 0 else 0
                    # Phone-like aspect ratio (portrait or landscape)
                    if (0.4 < aspect_ratio < 0.7) or (1.4 < aspect_ratio < 2.5):
                        device_detected = True
                        # Draw device detection
                        cv2.rectangle(frame, (x_c, y_c + frame.shape[0]//2), 
                                    (x_c+w_c, y_c+h_c + frame.shape[0]//2), (0, 0, 255), 2)
                        cv2.putText(frame, "DEVICE!", (x_c, y_c + frame.shape[0]//2 - 10),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                        break
                lower_frame = gray[frame.shape[0]//2:, :]  # Bottom half of frame
                # Look for rectangular objects (potential phones/tablets)
                edges = cv2.Canny(lower_frame, 50, 150)
                contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                for contour in contours:
                    area = cv2.contourArea(contour)
                    if area > 1000:  # Significant object
                        x_c, y_c, w_c, h_c = cv2.boundingRect(contour)
                        aspect_ratio = float(w_c) / h_c if h_c > 0 else 0
                        # Phone-like aspect ratio (portrait or landscape)
                        if (0.4 < aspect_ratio < 0.7) or (1.4 < aspect_ratio < 2.5):
                            device_detected = True
                            # Draw device detection
                            cv2.rectangle(frame, (x_c, y_c + frame.shape[0]//2), 
                                        (x_c+w_c, y_c+h_c + frame.shape[0]//2), (0, 0, 255), 2)
                            cv2.putText(frame, "DEVICE!", (x_c, y_c + frame.shape[0]//2 - 10),
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                            break
                # Score based on eye detection
            if len(eyes) >= 2:
                frame_score += 30.0  # Both eyes visible = +30
                status_text = "Both Eyes Visible"
                
                # Check eye position (should be in MIDDLE of face, not too high or low)
                avg_eye_y = sum([ey + eh//2 for (ex, ey, ew, eh) in eyes[:2]]) / min(2, len(eyes))
                
                # LOOKING UP detection (eyes in upper 25% of face - VERY SENSITIVE!)
                if avg_eye_y < h * 0.25:
                    frame_score = 15.0  # Very low - looking up (COPYING?)
                    status_text = "<!> LOOKING UP - COPYING?"
                    color = (0, 0, 255)  # Red
                    new_state = "away"
                
                # Good eye position (25-55% of face height)
                elif avg_eye_y < h * 0.55:
                    frame_score += 15.0  # Good eye position = +15
                    status_text = ">> FOCUSED ON SCREEN"
                
                # LOOKING DOWN (eyes in lower 45% of face)
                else:
                    status_text = "Looking Down"
                    frame_score -= 15.0  # Penalty for looking down
                    new_state = "looking_down"
                    
            elif len(eyes) == 1:
                frame_score += 15.0  # One eye = probably side angle
                status_text = "Side Angle - One Eye"
            else:
                # No eyes detected - possibly looking away
                frame_score += 10.0  # Small bonus for frontal face
                status_text = "Eyes Not Detected"
            
            # Penalty for device detected
            if device_detected:
                frame_score -= 30.0  # Major penalty
                status_text = "⚠ DEVICE IN HAND!"
            
            # Score based on face size (distance from camera)
            face_area = w * h
            frame_area = frame.shape[0] * frame.shape[1]
            face_ratio = face_area / frame_area
            
            # DIAGONAL DETECTION - Check if face is in corners (away from center)
            face_center_x = x + w//2
            face_center_y = y + h//2
            frame_center_x = frame.shape[1] // 2
            frame_center_y = frame.shape[0] // 2
            
            # Calculate diagonal distance from center
            x_offset = abs(face_center_x - frame_center_x)
            y_offset = abs(face_center_y - frame_center_y)
            
            # Define corner zones (outer 30% of frame in both X and Y)
            corner_threshold_x = frame.shape[1] * 0.3
            corner_threshold_y = frame.shape[0] * 0.3
            
            # Check if face is in diagonal corner position
            in_corner = x_offset > corner_threshold_x and y_offset > corner_threshold_y
            
            if in_corner:
                # Person is looking diagonally away from screen
                frame_score = min(frame_score, 20.0)  # Cap at 20% - very low
                status_text = "<!> LOOKING DIAGONAL (AWAY)"
                new_state = "away"
                self.logger.warning(f"Diagonal viewing detected: X offset={x_offset:.0f}, Y offset={y_offset:.0f}")
            
            # Face size bonus (more generous)
            if face_ratio > 0.02:  # Decent size
                size_bonus = min(15.0, face_ratio * 300)
                frame_score += size_bonus
            elif face_ratio < 0.01:  # Very small - probably too far or looking away
                frame_score -= 15.0
                if "LOOKING" not in status_text:
                    status_text += " (Too Far)"
            
            # Cap score at 100 (but can't go below 0)
            frame_score = max(0.0, min(100.0, frame_score))
            
            # Determine color and state based on score (ONLY if not already set to away)
            if new_state != "away":
                if frame_score >= 85:
                    color = (0, 255, 0)  # Green - Excellent
                    new_state = "focused"
                elif frame_score >= 70:
                    color = (0, 255, 255)  # Yellow - Good focus
                    new_state = "focused"
                elif frame_score >= 50:
                    color = (0, 165, 255)  # Orange - Moderate/Distracted
                    new_state = "looking_down"
                else:
                    color = (0, 0, 255)  # Red - Poor focus
                    new_state = "looking_down"
            # If already "away", color was already set above
            
            # Draw face rectangle
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 3)
            
            # Draw score on face
            score_text = f"{int(frame_score)}%"
            cv2.putText(
                frame, score_text, (x, y-30),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3
            )
            cv2.putText(
                frame, status_text, (x, y-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2
            )
            
            # Draw eye rectangles if detected
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (255, 0, 0), 2)
            
            # Reset counters
            self.face_missing_count = 0
        
        elif len(profile_faces_right) > 0 or len(profile_faces_left_adjusted) > 0:
            # Profile detected - away from screen (EITHER side)
            frame_score = 10.0  # Very low score - clearly not looking at screen
            new_state = "away"
            color = (0, 0, 255)  # Red
            
            # Choose which profile to display
            if len(profile_faces_right) > 0:
                px, py, pw, ph = profile_faces_right[0]
                status_text = "<!> LOOKING RIGHT (AWAY)"
            else:
                px, py, pw, ph = profile_faces_left_adjusted[0]
                status_text = "<!> LOOKING LEFT (AWAY)"
            cv2.rectangle(frame, (px, py), (px+pw, py+ph), color, 3)
            cv2.putText(
                frame, f"{int(frame_score)}%", (px, py-30),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 3
            )
            cv2.putText(
                frame, status_text, (px, py-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2
            )
            
            self.face_missing_count = 0
        
        else:
            # No face detected at all
            frame_score = 0.0
            self.face_missing_count += 1
            
            if self.face_missing_count > self.face_missing_threshold:
                new_state = "away"
                color = (0, 0, 255)  # Red
                status_text = "NO FACE DETECTED"
            else:
                new_state = self.current_state  # Keep previous state
                color = (0, 165, 255)  # Orange - checking
                status_text = "Checking..."
        
        # Update score history
        self.score_history.append(frame_score)
        if len(self.score_history) > self.max_score_history:
            self.score_history.pop(0)
        
        # Calculate score with fast response (weighted average favoring recent frames)
        if len(self.score_history) > 0:
            # Give more weight to recent frames for faster response
            if len(self.score_history) >= 5:
                recent_score = sum(self.score_history[-5:]) / 5  # Last 5 frames
                overall_avg = sum(self.score_history) / len(self.score_history)
                self.focus_score = (recent_score * 0.7) + (overall_avg * 0.3)  # 70% recent, 30% overall
            else:
                self.focus_score = sum(self.score_history) / len(self.score_history)
        
        # 5-SECOND TIMER for away from screen
        current_time = time.time()
        if new_state == "away" or frame_score < 50:  # Away or very low score
            if self.away_start_time is None:
                # Start timer
                self.away_start_time = current_time
                self.away_warning_shown = False
                self.logger.info("User looking away - timer started")
            
            # Calculate duration
            self.away_timer = current_time - self.away_start_time
            
            # Trigger WARNING after 5 seconds
            if self.away_timer >= 5.0 and not self.away_warning_shown:
                self.logger.warning(f"!!! WARNING !!! Away from screen for {self.away_timer:.1f} seconds!")
                status_text = f"<!> WARNING: AWAY {self.away_timer:.1f}s"
                self.away_warning_shown = True
                # Play sound if available
                try:
                    self._play_alert_sound("HIGH")
                except:
                    pass
        else:
            # Reset timer when looking at screen
            if self.away_start_time is not None:
                self.logger.info(f"User returned after {self.away_timer:.1f}s away")
            self.away_start_time = None
            self.away_timer = 0.0
            self.away_warning_shown = False
        
        # Store status text for warning display
        self.last_status_text = status_text
        
        # Handle state changes and alerts
        if new_state != previous_state:
            # Update time tracking
            time_in_state = current_time - self.last_state_change
            
            if previous_state == "focused":
                self.focused_time += time_in_state
            elif previous_state in ["away", "looking_away", "looking_down"]:
                self.distracted_time += time_in_state
            
            self.logger.info(f"State changed: {previous_state} -> {new_state}")
            self.current_state = new_state
            self.last_state_change = current_time
            
            # Trigger alerts for distracted states
            if new_state == "away":
                if self._can_trigger_alert("away"):
                    self.logger.error("ALERT: Student not present!")
                    self._play_alert_sound("HIGH")
                    if self.config['logging']['save_snapshots']:
                        self._save_snapshot(frame, "away")
            
            elif new_state == "looking_down":
                if self._can_trigger_alert("looking_down"):
                    self.logger.warning("ALERT: Student looking down!")
                    self._play_alert_sound("MEDIUM")
                    if self.config['logging']['save_snapshots']:
                        self._save_snapshot(frame, "looking_down")
            
            elif new_state == "looking_away":
                if self._can_trigger_alert("looking_away"):
                    self.logger.warning("ALERT: Student looking away!")
                    self._play_alert_sound("MEDIUM")
                    if self.config['logging']['save_snapshots']:
                        self._save_snapshot(frame, "looking_away")
        
        # Draw overlay
        self._draw_overlay(frame, color)
        
        return frame
    
    def _draw_overlay(self, frame, state_color):
        """Draw status overlay on frame with score."""
        height, width = frame.shape[:2]
        
        # Top banner
        overlay_height = 150
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (width, overlay_height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        # FOCUS SCORE - Large and prominent
        score_color = self._get_score_color(self.focus_score)
        score_text = f"FOCUS SCORE: {int(self.focus_score)}%"
        cv2.putText(
            frame, score_text, (10, 45),
            cv2.FONT_HERSHEY_SIMPLEX, 1.5, score_color, 4
        )
        
        # Score bar
        bar_x = 10
        bar_y = 60
        bar_width = 400
        bar_height = 30
        
        # Background bar
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), (50, 50, 50), -1)
        
        # Filled bar based on score
        fill_width = int(bar_width * (self.focus_score / 100))
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_width, bar_y + bar_height), score_color, -1)
        
        # Border
        cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_width, bar_y + bar_height), (255, 255, 255), 2)
        
        # Score thresholds markers
        for threshold, label in [(85, "85"), (70, "70"), (50, "50")]:
            marker_x = bar_x + int(bar_width * (threshold / 100))
            cv2.line(frame, (marker_x, bar_y), (marker_x, bar_y + bar_height), (255, 255, 255), 1)
        
        # State text
        state_text = f"State: {self.current_state.upper().replace('_', ' ')}"
        cv2.putText(
            frame, state_text, (10, 115),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, state_color, 2
        )
        
        # Stats on right side
        elapsed = time.time() - self.start_time
        fps = self.frame_count / elapsed if elapsed > 0 else 0
        
        cv2.putText(
            frame, f"FPS: {fps:.1f}", (width - 180, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2
        )
        
        cv2.putText(
            frame, f"Time: {int(elapsed)}s", (width - 180, 65),
            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2
        )
        
        # Score legend
        legend_y = 135
        cv2.putText(frame, "85-100: Excellent", (bar_x, legend_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
        cv2.putText(frame, "70-84: Good", (bar_x + 140, legend_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 255), 1)
        cv2.putText(frame, "50-69: Distracted", (bar_x + 250, legend_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 165, 255), 1)
        cv2.putText(frame, "<50: Poor", (bar_x + 380, legend_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
        
        # Display away timer if active
        if self.away_timer > 0:
            timer_color = (0, 165, 255) if self.away_timer < 5.0 else (0, 0, 255)
            timer_text = f"Away Timer: {self.away_timer:.1f}s / 5.0s"
            cv2.putText(frame, timer_text, (10, height - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, timer_color, 2)
            
            # Warning flashing text if >= 5 seconds
            if self.away_timer >= 5.0:
                warning_text = "!!! WARNING: LOOK AT SCREEN !!!"
                cv2.putText(frame, warning_text, (width//2 - 300, height//2),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
        
        # Special warning for copying/cheating behavior
        if self.current_state == "away" and hasattr(self, 'last_status_text'):
            if "COPYING" in self.last_status_text or "ABOVE CAMERA" in self.last_status_text:
                cheat_warning = "!!! SUSPICIOUS BEHAVIOR DETECTED !!!"
                cv2.putText(frame, cheat_warning, (width//2 - 350, height//2 + 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)
            
            # Warning for diagonal viewing
            if "DIAGONAL" in self.last_status_text:
                diag_warning = "!!! LOOKING AWAY DIAGONALLY !!!"
                cv2.putText(frame, diag_warning, (width//2 - 300, height//2 + 100),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 165, 255), 3)
    
    def _get_score_color(self, score):
        """Get color based on score."""
        if score >= 85:
            return (0, 255, 0)  # Green - Excellent
        elif score >= 70:
            return (0, 255, 255)  # Yellow - Good
        elif score >= 50:
            return (0, 165, 255)  # Orange - Distracted
        else:
            return (0, 0, 255)  # Red - Poor
        
        # Warning messages
        warning = None
        warning_color = (0, 0, 255)
        
        if self.current_state == "away":
            warning = "STUDENT NOT PRESENT!"
            warning_color = (0, 0, 255)  # Red
        elif self.current_state == "looking_down":
            warning = "LOOKING DOWN - Not Focused!"
            warning_color = (0, 140, 255)  # Dark Orange
        elif self.current_state == "looking_away":
            warning = "LOOKING AWAY - Not at Screen!"
            warning_color = (0, 165, 255)  # Orange
        
        if warning:
            (w, h), _ = cv2.getTextSize(warning, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)
            x = (frame.shape[1] - w) // 2
            y = frame.shape[0] - 60
            
            # Draw background
            cv2.rectangle(frame, (x-10, y-h-10), (x+w+10, y+10), warning_color, -1)
            cv2.putText(
                frame, warning, (x, y),
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3
            )
    
    def _save_snapshot(self, frame, alert_type):
        """Save snapshot of current frame."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{alert_type}_{timestamp}.jpg"
            filepath = os.path.join(self.snapshots_dir, filename)
            cv2.imwrite(filepath, frame)
            self.logger.info(f"Snapshot saved: {filepath}")
        except Exception as e:
            self.logger.error(f"Failed to save snapshot: {e}")
    
    def print_statistics(self):
        """Print session statistics."""
        elapsed = time.time() - self.start_time
        fps = self.frame_count / elapsed if elapsed > 0 else 0
        
        # Update final times
        time_in_current_state = time.time() - self.last_state_change
        if self.current_state == "focused":
            self.focused_time += time_in_current_state
        else:
            self.distracted_time += time_in_current_state
        
        focus_percentage = (self.focused_time / elapsed * 100) if elapsed > 0 else 0
        distracted_percentage = (self.distracted_time / elapsed * 100) if elapsed > 0 else 0
        
        print("\n" + "=" * 60)
        print("FOCUS MONITORING STATISTICS")
        print("=" * 60)
        print(f"\nSession Duration: {elapsed:.1f} seconds")
        print(f"Total Frames: {self.frame_count}")
        print(f"Average FPS: {fps:.1f}")
        
        # Score statistics
        if self.score_history:
            avg_score = sum(self.score_history) / len(self.score_history)
            max_score = max(self.score_history)
            min_score = min(self.score_history)
            
            print(f"\n📊 FOCUS SCORE STATISTICS:")
            print(f"   Current Score: {int(self.focus_score)}%")
            print(f"   Average Score: {int(avg_score)}%")
            print(f"   Max Score: {int(max_score)}%")
            print(f"   Min Score: {int(min_score)}%")
            
            # Score distribution
            excellent = sum(1 for s in self.score_history if s >= 85)
            good = sum(1 for s in self.score_history if 70 <= s < 85)
            distracted = sum(1 for s in self.score_history if 50 <= s < 70)
            poor = sum(1 for s in self.score_history if s < 50)
            total = len(self.score_history)
            
            print(f"\n📈 SCORE DISTRIBUTION:")
            print(f"   Excellent (85-100%): {excellent} frames ({excellent/total*100:.1f}%)")
            print(f"   Good (70-84%):       {good} frames ({good/total*100:.1f}%)")
            print(f"   Distracted (50-69%): {distracted} frames ({distracted/total*100:.1f}%)")
            print(f"   Poor (<50%):         {poor} frames ({poor/total*100:.1f}%)")
        
        print(f"\n⏱️  TIME BREAKDOWN:")
        print(f"   Focus Time: {self.focused_time:.1f}s ({focus_percentage:.1f}%)")
        print(f"   Distracted Time: {self.distracted_time:.1f}s ({distracted_percentage:.1f}%)")
        print("=" * 60 + "\n")
        
        # Reset the added time
        if self.current_state == "focused":
            self.focused_time -= time_in_current_state
        else:
            self.distracted_time -= time_in_current_state
    
    def run(self):
        """Main processing loop."""
        self.logger.info("Starting main processing loop...")
        print("\n" + "=" * 60)
        print("FOCUS MONITORING ACTIVE")
        print("=" * 60)
        print("\nControls:")
        print("  Q - Quit")
        print("  R - Reset statistics")
        print("  S - Save snapshot")
        print("  P - Print statistics")
        print("\nMonitoring started...\n")
        
        try:
            while True:
                ret, frame = self.cap.read()
                
                if not ret:
                    self.logger.error("Failed to read frame")
                    break
                
                self.frame_count += 1
                
                # Process frame
                annotated_frame = self.process_frame(frame)
                
                # Display
                if self.show_video:
                    cv2.imshow(self.window_name, annotated_frame)
                    
                    key = cv2.waitKey(1) & 0xFF
                    
                    if key == ord('q'):
                        self.logger.info("Quit requested by user")
                        break
                    elif key == ord('r'):
                        self._reset_statistics()
                    elif key == ord('s'):
                        self._save_snapshot(annotated_frame, "manual")
                        print("Snapshot saved!")
                    elif key == ord('p'):
                        self.print_statistics()
                
                # Periodic logging
                if self.frame_count % 300 == 0:
                    elapsed = time.time() - self.start_time
                    fps = self.frame_count / elapsed
                    self.logger.info(
                        f"Processed {self.frame_count} frames | "
                        f"FPS: {fps:.1f} | State: {self.current_state}"
                    )
        
        except KeyboardInterrupt:
            self.logger.info("Interrupted by user (Ctrl+C)")
        
        finally:
            self.cleanup()
    
    def _reset_statistics(self):
        """Reset all statistics."""
        self.frame_count = 0
        self.start_time = time.time()
        self.focused_time = 0
        self.away_time = 0
        self.distracted_time = 0
        self.last_state_change = time.time()
        self.face_missing_count = 0
        self.looking_away_count = 0
        self.looking_down_count = 0
        self.logger.info("Statistics reset")
        print("Statistics reset!")
    
    def cleanup(self):
        """Cleanup resources."""
        self.logger.info("Cleaning up...")
        
        # Print final statistics
        self.print_statistics()
        
        # Release camera
        if self.cap is not None:
            self.cap.release()
        
        # Close windows
        cv2.destroyAllWindows()
        
        self.logger.info("Focus Monitoring System stopped")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Focus Monitoring System (OpenCV Version - No PyTorch Required)"
    )
    
    parser.add_argument(
        '--config',
        type=str,
        default='config.yaml',
        help='Path to configuration file'
    )
    
    parser.add_argument(
        '--no-display',
        action='store_true',
        help='Disable video display'
    )
    
    args = parser.parse_args()
    
    # Load and modify config
    with open(args.config, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    if args.no_display:
        config['display']['show_video'] = False
    
    # Save modified config
    temp_config = 'temp_config.yaml'
    with open(temp_config, 'w', encoding='utf-8') as f:
        yaml.dump(config, f)
    
    # Create and run monitor
    try:
        monitor = SimpleFocusMonitor(temp_config)
        monitor.run()
    except Exception as e:
        logging.error(f"Fatal error: {e}", exc_info=True)
        return 1
    finally:
        if os.path.exists(temp_config):
            os.remove(temp_config)
    
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
