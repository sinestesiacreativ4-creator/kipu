import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

console.log('ffmpegPath:', ffmpegPath);

if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
            console.error('Error getting formats:', err);
        } else {
            console.log('Formats available:', Object.keys(formats).length);
        }
    });
} else {
    console.error('ffmpeg-static path is null');
}
