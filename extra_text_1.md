Here are the updated files. I have implemented a robust `fetchWithProgress` system in `audio.js` to handle the **Model Loading %**. For the **Generation %**, since audio generation time varies, I have added a visual "Processing" state that updates the specific button pressed, ensuring the user knows the system is working before audio begins.

### Implementation Details

1.  **Model Loading**: The "Play All" button now acts as a global status indicator during initialization. It will show real-time download percentage (`Loading Model: 45%`) before unlocking.
2.  **Button Management**: All TTS buttons (Play All and Section buttons) are disabled until the model is fully loaded to prevent errors.
3.  **Generation Feedback**: When a button is clicked, it enters a "Processing" state (visualized as an hourglass or "..." depending on space) until the first audio chunk is received.