import { ServiceUnavailableException } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchResult, SearchService } from './search.service';

function makeController(search: jest.Mock) {
  return new SearchController({ search } as unknown as SearchService);
}

describe('SearchController', () => {
  it('returns no results for short queries without calling YouTube', async () => {
    const search = jest.fn();
    const controller = makeController(search);
    expect(await controller.search(' a ')).toEqual({ results: [] });
    expect(await controller.search(undefined)).toEqual({ results: [] });
    expect(search).not.toHaveBeenCalled();
  });

  it('passes trimmed queries to the service', async () => {
    const results: SearchResult[] = [
      {
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley',
        durationSeconds: 214,
        channel: 'Rick Astley',
      },
    ];
    const search = jest.fn().mockResolvedValue(results);
    const controller = makeController(search);
    expect(await controller.search('  rick astley ')).toEqual({ results });
    expect(search).toHaveBeenCalledWith('rick astley');
  });

  it('maps scraper failures to 503 so the UI can fall back', async () => {
    const search = jest.fn().mockRejectedValue(new Error('blocked'));
    const controller = makeController(search);
    await expect(controller.search('anything')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
