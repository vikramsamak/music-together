import { Injectable, Logger } from '@nestjs/common';
import { YouTube } from 'youtube-sr';

export interface SearchResult {
  videoId: string;
  title: string;
  durationSeconds: number;
  channel: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  async search(query: string): Promise<SearchResult[]> {
    const videos = await YouTube.search(query, {
      limit: 8,
      type: 'video',
      safeSearch: false,
    });
    return videos
      .map((video) => ({
        videoId: video.id ?? '',
        title: video.title ?? video.id ?? '',
        durationSeconds: Math.round((video.duration ?? 0) / 1000),
        channel: video.channel?.name ?? '',
      }))
      .filter((result) => result.videoId.length > 0);
  }
}
