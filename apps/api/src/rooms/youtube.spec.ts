import { parseVideoId } from './youtube';

describe('parseVideoId', () => {
  it('accepts a bare 11-character id', () => {
    expect(parseVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('parses standard watch URLs', () => {
    expect(parseVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      parseVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('parses short and music URLs', () => {
    expect(parseVideoId('https://youtu.be/dQw4w9WgXcQ?si=xyz')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      parseVideoId(
        'https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
      ),
    ).toBe('dQw4w9WgXcQ');
  });

  it('rejects non-YouTube and malformed input', () => {
    expect(parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(parseVideoId('https://www.youtube.com/watch?v=shorter')).toBeNull();
    expect(parseVideoId('')).toBeNull();
    expect(parseVideoId('not a url')).toBeNull();
  });
});
