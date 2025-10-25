// Simple test to verify Peaks.js is working
console.log('Testing Peaks.js availability...');

if (typeof Peaks !== 'undefined') {
    console.log('✅ Peaks.js is available:', Peaks);
    console.log('✅ Peaks.init function:', typeof Peaks.init);
} else {
    console.error('❌ Peaks.js is not available');
}

if (typeof Konva !== 'undefined') {
    console.log('✅ Konva is available:', Konva);
} else {
    console.error('❌ Konva is not available');
}

if (typeof WaveformData !== 'undefined') {
    console.log('✅ WaveformData is available:', WaveformData);
} else {
    console.error('❌ WaveformData is not available');
}
