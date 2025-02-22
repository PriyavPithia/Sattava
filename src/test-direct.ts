import axios from 'axios';

const testAPI = async () => {
  // Using a different video ID (from a TED Talk which should have transcripts)
  const url = 'https://www.searchapi.io/api/v1/search';
  const params = {
    engine: 'youtube_transcripts',
    video_id: 'eIho2S0ZahI',  // TED Talk video
    api_key: 'bjmQDNM7WQ4jp8vxk28BLrLM'
  };

  try {
    console.log('Making API request with params:', params);
    const response = await axios.get(url, { params });
    
    console.log('\nResponse Status:', response.status);
    console.log('\nResponse Headers:', JSON.stringify(response.headers, null, 2));
    console.log('\nResponse Data:', JSON.stringify(response.data, null, 2));
    
    // Check if we got a transcript
    if (response.data.transcript) {
      console.log('\nSuccess! Transcript found.');
      console.log('\nFirst 200 characters of transcript:', response.data.transcript.substring(0, 200));
    } else {
      console.log('\nNo transcript in response. Available fields:', Object.keys(response.data));
    }
  } catch (error: any) {
    console.error('\nError occurred:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Error Headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received');
      console.error(error.request);
    } else {
      console.error('Error:', error.message);
    }
    console.error('\nFull error object:', error);
  }
};

console.log('Starting API test with TED Talk video...\n');
testAPI();