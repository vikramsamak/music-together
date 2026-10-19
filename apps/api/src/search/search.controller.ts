import {
  Controller,
  Get,
  Logger,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SearchResult, SearchService } from './search.service';

@Controller('api/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Query('q') q?: string): Promise<{ results: SearchResult[] }> {
    const query = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    if (query.length < 2) return { results: [] };
    try {
      return { results: await this.searchService.search(query) };
    } catch (error) {
      this.logger.warn(
        `search failed for "${query}": ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException('search unavailable');
    }
  }
}
