import axios from 'axios';

const testTranscriptAPI = async () => {
  const videoId = '0e3GPea1Tyg';
  const url = 'https://www.searchapi.io/api/v1/search';
  
  console.log('Testing API with video ID:', videoId);
  
  try {
    const response = await axios.get(url, {
      params: {
        engine: 'youtube_transcripts',
        video_id: videoId,
        api_key: 'bjmQDNM7WQ4jp8vxk28BLrLM'
      }
    });

    console.log('API Response Status:', response.status);
    console.log('Response Headers:', response.headers);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.transcript) {
      console.log('\nTranscript found!');
      console.log('First 200 characters:', response.data.transcript.substring(0, 200));
    } else {
      console.log('\nNo transcript found in response');
      console.log('Full response structure:', Object.keys(response.data));
    }
  } catch (error: any) {
    console.error('API Error:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
  }
};

// Run the test
testTranscriptAPI();