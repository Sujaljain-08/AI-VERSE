/**
 * Video Recorder Utility
 * Records video clips when cheating behavior is detected
 * Works with continuous WebSocket streaming (doesn't interrupt analysis)
 */

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private recordingStartTime: number = 0;
  private recordingTimeout: NodeJS.Timeout | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  /**
   * Start recording a video clip
   * @param maxDuration Maximum recording duration in seconds (default: 10s)
   */
  async startRecording(maxDuration: number = 10): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      this.recordedChunks = [];
      
      // Use webm format for better browser support
      const options = { mimeType: 'video/webm;codecs=vp9' };
      
      // Fallback to vp8 if vp9 not supported
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
      }

      this.mediaRecorder = new MediaRecorder(this.stream!, options);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      console.log('Recording started');

      // Auto-stop after maxDuration
      this.recordingTimeout = setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, maxDuration * 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return the video blob
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.isRecording = false;
        this.recordedChunks = [];
        
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        console.log(`Recording stopped. Duration: ${duration.toFixed(1)}s, Size: ${(blob.size / 1024).toFixed(0)}KB`);
        
        resolve(blob);
      };

      this.mediaRecorder!.stop();
    });
  }

  /**
   * Upload recorded video to server
   */
  async uploadVideo(
    videoBlob: Blob,
    sessionId: string,
    studentId: string
  ): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append('video', videoBlob);
      formData.append('session_id', sessionId);
      formData.append('student_id', studentId);
      formData.append('timestamp', Date.now().toString());

      const response = await fetch('/api/exam/upload-video', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      console.log('Video uploaded:', result.storage_path);
      return true;

    } catch (error) {
      console.error('Failed to upload video:', error);
      return false;
    }
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
  }
}

/**
 * Smart Recording Manager
 * Manages continuous WebSocket streaming + selective video recording
 */
export class SmartRecordingManager {
  private recorder: VideoRecorder;
  private scoreBuffer: any[] = [];
  private readonly BUFFER_SIZE = 30; // Keep last 30 frames (1 second at 30fps)
  private readonly SUSPICIOUS_THRESHOLD = 50; // Focus score below 50 = suspicious

  constructor(stream: MediaStream) {
    this.recorder = new VideoRecorder(stream);
  }

  /**
   * Process analysis result from WebSocket
   * Automatically starts recording when suspicious behavior detected
   */
  async processAnalysis(result: any): Promise<void> {
    // Add to buffer
    this.scoreBuffer.push(result);
    if (this.scoreBuffer.length > this.BUFFER_SIZE) {
      this.scoreBuffer.shift();
    }

    // Check if should start recording
    if (result.focus_score < this.SUSPICIOUS_THRESHOLD && !this.recorder.recording) {
      console.log('🔴 Suspicious behavior detected - Starting recording');
      await this.recorder.startRecording(10); // Record 10 seconds
    }
  }

  /**
   * Get scores buffer for batch saving
   */
  getScoresForSaving(): any[] {
    // Return every 10th frame to reduce DB writes (3 scores per second instead of 30)
    return this.scoreBuffer.filter((_, index) => index % 10 === 0);
  }

  /**
   * Clear scores buffer after saving
   */
  clearSavedScores(): void {
    this.scoreBuffer = [];
  }

  /**
   * Stop recording and upload video
   */
  async stopAndUpload(sessionId: string, studentId: string): Promise<boolean> {
    if (!this.recorder.recording) {
      return false;
    }

    const videoBlob = await this.recorder.stopRecording();
    if (videoBlob) {
      return await this.recorder.uploadVideo(videoBlob, sessionId, studentId);
    }
    return false;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.recorder.cleanup();
    this.scoreBuffer = [];
  }
}
