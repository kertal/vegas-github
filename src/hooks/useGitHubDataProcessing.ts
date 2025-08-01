import { useMemo } from 'react';
import { GitHubEvent, GitHubItem } from '../types';
import { processRawEvents, categorizeRawSearchItems } from '../utils/rawDataUtils';

interface UseGitHubDataProcessingProps {
  indexedDBEvents: GitHubEvent[];
  indexedDBSearchItems: GitHubEvent[];
  startDate: string;
  endDate: string;
  apiMode: 'search' | 'events' | 'summary';
}

interface UseGitHubDataProcessingReturn {
  results: GitHubItem[];
  searchItemsCount: number;
  eventsCount: number;
  rawEventsCount: number;
}

export const useGitHubDataProcessing = ({
  indexedDBEvents,
  indexedDBSearchItems,
  startDate,
  endDate,
  apiMode,
}: UseGitHubDataProcessingProps): UseGitHubDataProcessingReturn => {
  // Categorize raw data into processed items based on current API mode and date filters
  const results = useMemo(() => {
    if (apiMode === 'events') {
      // Events view: only processed events
      return processRawEvents(indexedDBEvents, startDate, endDate);
    } else if (apiMode === 'search') {
      // Issues and PRs view: only search items
      return categorizeRawSearchItems(
        indexedDBSearchItems as unknown as GitHubItem[],
        startDate,
        endDate
      );
    } else if (apiMode === 'summary') {
      // Summary view: merge both events AND search items for complete picture
      const processedEvents = processRawEvents(indexedDBEvents, startDate, endDate);
      const processedSearchItems = categorizeRawSearchItems(
        indexedDBSearchItems as unknown as GitHubItem[],
        startDate,
        endDate
      );
      
      // Combine both datasets, removing duplicates based on html_url
      const urlSet = new Set<string>();
      const combinedResults: GitHubItem[] = [];
      
      // Add search items first (they are more complete/accurate)
      processedSearchItems.forEach(item => {
        if (!urlSet.has(item.html_url)) {
          urlSet.add(item.html_url);
          combinedResults.push(item);
        }
      });
      
      // Add events that aren't already covered by search items
      processedEvents.forEach(item => {
        if (!urlSet.has(item.html_url)) {
          urlSet.add(item.html_url);
          combinedResults.push(item);
        }
      });
      
      // Sort by updated_at (newest first)
      return combinedResults.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    } else {
      return [];
    }
  }, [apiMode, indexedDBEvents, indexedDBSearchItems, startDate, endDate]);

  // Calculate counts for navigation tabs
  const searchItemsCount = useMemo(() => {
    return categorizeRawSearchItems(
      indexedDBSearchItems as unknown as GitHubItem[],
      startDate,
      endDate
    ).length;
  }, [indexedDBSearchItems, startDate, endDate]);

  const eventsCount = useMemo(() => {
    return processRawEvents(indexedDBEvents, startDate, endDate).length;
  }, [indexedDBEvents, startDate, endDate]);

  // Calculate grouped events count (number of unique URLs after grouping)
  // (Removed groupedEventsCount)

  const rawEventsCount = indexedDBEvents.length;

  return {
    results,
    searchItemsCount,
    eventsCount,
    rawEventsCount,
  };
}; 