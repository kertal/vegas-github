import React, { memo, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Text,
  Heading,
  Link,
  ButtonGroup,
  Avatar,
  Stack,
  Label,
  Checkbox,
  ActionMenu,
  ActionList,
  Dialog,
  IconButton,
  TextInput,
  FormControl,
} from '@primer/react';
import {
  GitPullRequestIcon,
  IssueOpenedIcon,
  XIcon,
  GitMergeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PasteIcon,
  SearchIcon,
  CheckIcon,
} from '@primer/octicons-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getContrastColor } from '../utils';
import { GitHubItem } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { useCopyFeedback } from '../hooks/useCopyFeedback';

import { ResultsContainer } from './ResultsContainer';
import { copyResultsToClipboard as copyToClipboard } from '../utils/clipboard';

// Import context hook and helper functions from App.tsx
interface UseResultsContextHookType {
  results: GitHubItem[];
  filteredResults: GitHubItem[];
  filter: 'all' | 'issue' | 'pr' | 'comment';
  statusFilter: 'all' | 'open' | 'closed' | 'merged';
  includedLabels: string[];
  excludedLabels: string[];
  searchText: string;
  repoFilters: string[];
  userFilter: string;
  availableLabels: string[];
  setFilter: (filter: 'all' | 'issue' | 'pr' | 'comment') => void;
  setStatusFilter: (filter: 'all' | 'open' | 'closed' | 'merged') => void;
  setIncludedLabels: React.Dispatch<React.SetStateAction<string[]>>;
  setExcludedLabels: React.Dispatch<React.SetStateAction<string[]>>;
  toggleDescriptionVisibility: (id: number) => void;
  toggleExpand: (id: number) => void;
  copyResultsToClipboard: (format: 'detailed' | 'compact') => void;
  descriptionVisible: { [id: number]: boolean };
  expanded: { [id: number]: boolean };
  clipboardMessage: string | null;
  clearAllFilters: () => void;
  isCompactView: boolean;
  setIsCompactView: (compact: boolean) => void;
  selectedItems: Set<string | number>;
  selectAllItems: () => void;
  clearSelection: () => void;
  toggleItemSelection: (id: string | number) => void;
  setRepoFilters: React.Dispatch<React.SetStateAction<string[]>>;
  setUserFilter: React.Dispatch<React.SetStateAction<string>>;
  setSearchText: (searchText: string) => void;
  isClipboardCopied: (itemId: string | number) => boolean;
}

// Props interface
interface ResultsListProps {
  useResultsContext: () => UseResultsContextHookType;

  buttonStyles: React.CSSProperties;
}

// Add new interface for the description dialog
interface DescriptionDialogProps {
  item: GitHubItem | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

const DescriptionDialog = memo(function DescriptionDialog({
  item,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: DescriptionDialogProps) {
  // Add keyboard navigation
  React.useEffect(() => {
    if (!item) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onPrevious, onNext, onClose, hasPrevious, hasNext]);

  if (!item) return null;

  return (
    <Dialog
      onClose={onClose}
      role="dialog"
      title={
        <Box
          sx={{
            display: 'flex',
            p: 2,
            alignItems: 'center',
            gap: 2,
            width: '100%',
          }}
        >
          {item.pull_request ? (
            item.pull_request.merged_at ? (
              <Box sx={{ color: 'done.fg' }}>
                <GitMergeIcon size={16} />
              </Box>
            ) : item.state === 'closed' ? (
              <Box sx={{ color: 'closed.fg' }}>
                <GitPullRequestIcon size={16} />
              </Box>
            ) : (
              <Box sx={{ color: 'open.fg' }}>
                <GitPullRequestIcon size={16} />
              </Box>
            )
          ) : (
            <Box
              sx={{ color: item.state === 'closed' ? 'closed.fg' : 'open.fg' }}
            >
              <IssueOpenedIcon size={16} />
            </Box>
          )}
          <Text sx={{ flex: 1, fontWeight: 'bold', fontSize: 2 }}>
            {item.title}
          </Text>
        </Box>
      }
      renderFooter={() => (
        <div>
          <IconButton
            icon={ChevronLeftIcon}
            aria-label="Previous item"
            onClick={onPrevious}
            disabled={!hasPrevious}
            sx={{ color: hasPrevious ? 'fg.default' : 'fg.muted' }}
          />
          <IconButton
            icon={ChevronRightIcon}
            aria-label="Next item"
            onClick={onNext}
            disabled={!hasNext}
            sx={{ color: hasNext ? 'fg.default' : 'fg.muted' }}
          />
        </div>
      )}
    >
      <Box
        sx={{
          p: 3,
          height: 'calc(100vh - 120px)',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            fontSize: 1,
            color: 'fg.muted',
          }}
        >
          <Avatar src={item.user.avatar_url} size={20} />
          <Link
            href={item.user.html_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.user.login}
          </Link>
          <Text>•</Text>
          <Link href={item.html_url} target="_blank" rel="noopener noreferrer">
            {new URL(item.html_url).pathname}
          </Link>
        </Box>

        <Box
          sx={{
            bg: 'canvas.default',
            p: 3,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'border.default',
            fontSize: 1,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ ...props }) => (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: 'accent.fg' }}
                  {...props}
                />
              ),
              pre: ({ ...props }) => (
                <Box
                  as="pre"
                  sx={{
                    bg: 'canvas.subtle',
                    p: 2,
                    borderRadius: 1,
                    overflowX: 'auto',
                    fontSize: 0,
                    border: '1px solid',
                    borderColor: 'border.muted',
                  }}
                  {...props}
                />
              ),
              code: ({
                inline,
                ...props
              }: { inline?: boolean } & React.HTMLAttributes<HTMLElement>) =>
                inline ? (
                  <Box
                    as="code"
                    sx={{
                      bg: 'canvas.subtle',
                      p: '2px 4px',
                      borderRadius: 1,
                      fontSize: 0,
                    }}
                    {...props}
                  />
                ) : (
                  <Box
                    as="code"
                    sx={{ display: 'block', fontSize: 0 }}
                    {...props}
                  />
                ),
              img: ({ ...props }) => (
                <Box
                  as="img"
                  sx={{ maxWidth: '100%', height: 'auto' }}
                  {...props}
                />
              ),
            }}
          >
            {item.body || '*No description provided*'}
          </ReactMarkdown>
        </Box>
      </Box>
    </Dialog>
  );
});

const ResultsList = memo(function ResultsList({
  useResultsContext,
  buttonStyles,
}: ResultsListProps) {
  const {
    results,
    filteredResults,
    filter,
    statusFilter,
    includedLabels = [],
    excludedLabels = [],
    searchText,
    repoFilters = [],
    userFilter = '',
    setSearchText,
    copyResultsToClipboard,
    clearAllFilters,
    isCompactView,
    setIsCompactView,
    selectedItems,
    toggleItemSelection,
    selectAllItems,
    clearSelection,
    isClipboardCopied,
  } = useResultsContext();



  // Add state for filters active/inactive toggle
  const [areFiltersActive, setAreFiltersActive] = useLocalStorage(
    'github-filters-active',
    true
  );

  // Add state for the description dialog
  const [selectedItemForDialog, setSelectedItemForDialog] =
    useState<GitHubItem | null>(null);

  // Use debounced search hook
  const { inputValue, setInputValue, clearSearch } = useDebouncedSearch(
    searchText,
    setSearchText,
    300
  );

  // Use copy feedback hook
  const { isCopied, triggerCopy } = useCopyFeedback(2000);

  // Helper to check if any filters are configured
  const hasConfiguredFilters =
    filter !== 'all' ||
    statusFilter !== 'all' ||
    userFilter !== '' ||
    includedLabels.length > 0 ||
    searchText !== '' ||
    repoFilters.length > 0 ||
    excludedLabels.length > 0;

  // Helper to check if any filters are active (configured AND enabled)
  const hasActiveFilters = areFiltersActive && hasConfiguredFilters;

  // Calculate select all checkbox state
  const selectAllState = useMemo(() => {
    const displayResults = areFiltersActive ? filteredResults : results;
    if (displayResults.length === 0) {
      return { checked: false, indeterminate: false };
    }

    const selectedCount = displayResults.filter(item =>
      selectedItems.has(item.event_id || item.id)
    ).length;

    if (selectedCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (selectedCount === displayResults.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  }, [areFiltersActive, filteredResults, results, selectedItems]);

  // Handle select all checkbox click
  const handleSelectAllChange = () => {
    const displayResults = areFiltersActive ? filteredResults : results;
    const selectedCount = displayResults.filter(item =>
      selectedItems.has(item.event_id || item.id)
    ).length;

    if (selectedCount === displayResults.length) {
      // All are selected, clear selection
      clearSelection();
    } else {
      // Some or none are selected, select all
      selectAllItems();
    }
  };



  // Add navigation logic
  const handlePreviousItem = () => {
    if (!selectedItemForDialog) return;
    const currentIndex = filteredResults.findIndex(
      item => item.id === selectedItemForDialog.id
    );
    if (currentIndex > 0) {
      setSelectedItemForDialog(filteredResults[currentIndex - 1]);
    }
  };

  const handleNextItem = () => {
    if (!selectedItemForDialog) return;
    const currentIndex = filteredResults.findIndex(
      item => item.id === selectedItemForDialog.id
    );
    if (currentIndex < filteredResults.length - 1) {
      setSelectedItemForDialog(filteredResults[currentIndex + 1]);
    }
  };

  const getCurrentItemIndex = () => {
    if (!selectedItemForDialog) return -1;
    return filteredResults.findIndex(
      item => item.id === selectedItemForDialog.id
    );
  };

  // Single item clipboard copy handler
  const copySingleItemToClipboard = async (item: GitHubItem) => {
    const itemId = item.event_id || item.id;
    const result = await copyToClipboard([item], {
      isCompactView: true, // Use compact format for single items
      onSuccess: () => {
        // Trigger copy feedback animation
        triggerCopy(itemId);
      },
      onError: (error: Error) => {
        console.error('Failed to copy item:', error);
      },
    });

    return result;
  };

  return (
    <Box>
      {/* Results Section */}
      <ResultsContainer
        headerLeft={
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Checkbox
                checked={selectAllState.checked}
                indeterminate={selectAllState.indeterminate}
                onChange={handleSelectAllChange}
                aria-label="Select all items"
                disabled={
                  (areFiltersActive ? filteredResults : results).length === 0
                }
              />
              <Heading
                as="h2"
                sx={{
                  fontSize: 2,
                  fontWeight: 'semibold',
                  color: 'fg.default',
                  m: 0,
                }}
              >
                Issues and PRs
              </Heading>
              <ActionMenu>
                <ActionMenu.Button
                  variant="default"
                  size="small"
                  sx={{
                    ...buttonStyles,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontSize: 0,
                    borderColor: 'border.default',
                  }}
                >
                  {(isClipboardCopied('compact') || isClipboardCopied('detailed')) ? (
                    <CheckIcon size={14} />
                  ) : (
                    <PasteIcon size={14} />
                  )}
                  {(() => {
                    const displayResults = areFiltersActive
                      ? filteredResults
                      : results;
                    const visibleSelectedCount = displayResults.filter(
                      item =>
                        selectedItems instanceof Set &&
                        selectedItems.has(item.event_id || item.id)
                    ).length;
                    return visibleSelectedCount > 0
                      ? visibleSelectedCount
                      : displayResults.length;
                  })()}
                </ActionMenu.Button>

                <ActionMenu.Overlay>
                  <ActionList>
                    <ActionList.Item
                      onSelect={() => copyResultsToClipboard('compact')}
                    >
                      Compact (Links with Titles)
                    </ActionList.Item>
                    <ActionList.Item
                      onSelect={() => copyResultsToClipboard('detailed')}
                    >
                      Detailed (Containing the content)
                    </ActionList.Item>
                  </ActionList>
                </ActionMenu.Overlay>
              </ActionMenu>
            </Box>

          </>
        }
        headerRight={
          <>
            <Box sx={{ display: 'none' }}>
              <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Filters:</Text>
              <ButtonGroup>
                <Button
                  size="small"
                  variant={areFiltersActive ? 'primary' : 'default'}
                  onClick={() => setAreFiltersActive(true)}
                  sx={{
                    ...buttonStyles,
                    border:
                      areFiltersActive && hasConfiguredFilters
                        ? '2px solid'
                        : '1px solid',
                    borderColor:
                      areFiltersActive && hasConfiguredFilters
                        ? 'success.emphasis'
                        : 'border.default',
                  }}
                >
                  Active
                </Button>
                <Button
                  size="small"
                  variant={!areFiltersActive ? 'primary' : 'default'}
                  onClick={() => setAreFiltersActive(false)}
                  sx={buttonStyles}
                >
                  Off
                </Button>
              </ButtonGroup>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl>
                <FormControl.Label visuallyHidden>
                  Search issues and PRs
                </FormControl.Label>
                <TextInput
                  placeholder="Search issues and PRs"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  leadingVisual={SearchIcon}
                  size="small"
                  sx={{ minWidth: '300px' }}
                />
              </FormControl>
              <Text sx={{ fontSize: 1, color: 'fg.muted' }}>View:</Text>
              <ButtonGroup>
              
                <Button
                  size="small"
                  variant={isCompactView ? 'primary' : 'default'}
                  onClick={() => setIsCompactView(true)}
                  sx={buttonStyles}
                >
                  Compact
                </Button>
                <Button
                  size="small"
                  variant={!isCompactView ? 'primary' : 'default'}
                  onClick={() => setIsCompactView(false)}
                  sx={buttonStyles}
                >
                  Detailed
                </Button>
              </ButtonGroup>
            </Box>
          </>
        }
      >
        <Box sx={{ p: 3 }}>


          {/* Results List */}
          {(() => {
            const displayResults = areFiltersActive ? filteredResults : results;

            if (displayResults.length === 0) {
              return (
                <Box
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: 'border.default',
                    borderRadius: 2,
                    bg: 'canvas.subtle',
                  }}
                >
                  {results.length === 0 ? (
                    <Box>
                      <Text sx={{ fontSize: 2, color: 'fg.muted', mb: 2 }}>
                        No data available
                      </Text>
                      <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
                        Load some GitHub data to see results here.
                      </Text>
                    </Box>
                  ) : (
                    <Box>
                      <Text sx={{ fontSize: 2, color: 'fg.muted', mb: 2 }}>
                        No matches found
                      </Text>
                      <Text sx={{ fontSize: 1, color: 'fg.muted', mb: 3 }}>
                        {searchText 
                          ? `No items found matching "${searchText}". Try a different search term, use label:name or -label:name for label filtering, or adjust your filters.`
                          : `Your current filters don't match any of the ${results.length} available items.`}
                      </Text>
                      {hasActiveFilters && (
                        <Button
                          variant="default"
                          onClick={clearAllFilters}
                          sx={buttonStyles}
                        >
                          Clear All Filters
                        </Button>
                      )}
                      {searchText && (
                        <Button
                          variant="default"
                          onClick={clearSearch}
                          sx={{ ...buttonStyles, ml: 2 }}
                        >
                          Clear Search
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              );
            }

            return isCompactView ? (
              <Box sx={{ gap: 1 }}>
                {displayResults.map(item => (
                  <Box
                    key={item.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      py: 1,
                      px: 2,
                      borderRadius: 1,
                      ':hover': {
                        bg: 'canvas.subtle',
                      },
                    }}
                  >
                    <Checkbox
                      checked={
                        selectedItems instanceof Set &&
                        selectedItems.has(item.event_id || item.id)
                      }
                      onChange={() =>
                        toggleItemSelection(item.event_id || item.id)
                      }
                    />
                    {item.pull_request ? (
                      item.pull_request.merged_at || item.merged ? (
                        <Box sx={{ color: 'done.fg', display: 'flex' }}>
                          <GitMergeIcon size={16} />
                        </Box>
                      ) : item.state === 'closed' ? (
                        <Box sx={{ color: 'closed.fg', display: 'flex' }}>
                          <GitPullRequestIcon size={16} />
                        </Box>
                      ) : (
                        <Box sx={{ color: 'open.fg', display: 'flex' }}>
                          <GitPullRequestIcon size={16} />
                        </Box>
                      )
                    ) : item.state === 'closed' ? (
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'inline-flex',
                          color: 'closed.fg',
                        }}
                      >
                        <IssueOpenedIcon size={16} />
                        <Box
                          sx={{ position: 'absolute', top: '3px', left: '3px' }}
                        >
                          <XIcon size={10} />
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ color: 'open.fg', display: 'flex' }}>
                        <IssueOpenedIcon size={16} />
                      </Box>
                    )}
                    <Avatar
                      src={item.user.avatar_url}
                      alt={`${item.user.login}'s avatar`}
                      size={16}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        // Add user to search text in format user:{username}
                        const userSearchTerm = `user:${item.user.login}`;
                        const currentSearch = searchText.trim();
                        
                        // Check if this user is already in the search text
                        const userRegex = new RegExp(`\\buser:${item.user.login.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`);
                        if (!userRegex.test(currentSearch)) {
                          const newSearchText = currentSearch 
                            ? `${currentSearch} ${userSearchTerm}`
                            : userSearchTerm;
                          setSearchText(newSearchText);
                        }
                      }}
                    />
                    <Text
                      sx={{ fontSize: 1, color: 'fg.muted', flexShrink: 0 }}
                    >
                      {item.user.login}
                    </Text>
                    <Link
                      href={item.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        textDecoration: 'none',
                        fontSize: 1,
                        flexGrow: 1,
                        minWidth: 0,
                        ':hover': { textDecoration: 'underline' },
                      }}
                    >
                      <Text
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </Text>
                    </Link>
                    <Text
                      sx={{ fontSize: 0, color: 'fg.muted', flexShrink: 0 }}
                    >
                      {item.repository_url?.split('/').slice(-1)[0] || 'N/A'}
                    </Text>
                    <Text
                      sx={{ fontSize: 0, color: 'fg.muted', flexShrink: 0 }}
                    >
                      {new Date(item.updated_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    {item.body && (
                      <div>
                        <IconButton
                          icon={EyeIcon}
                          variant="invisible"
                          aria-label="Show description"
                          size="small"
                          onClick={() => setSelectedItemForDialog(item)}
                        ></IconButton>
                        <IconButton
                          icon={isCopied(item.event_id || item.id) ? CheckIcon : PasteIcon}
                          variant="invisible"
                          aria-label="Copy to clipboard"
                          size="small"
                          onClick={() => copySingleItemToClipboard(item)}
                        ></IconButton>
                      </div>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <Stack sx={{ gap: 3 }}>
                {displayResults.map(item => (
                  <Box
                    key={item.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'border.default',
                      borderRadius: 2,
                      p: 3,
                      bg: 'canvas.subtle',
                      ':last-child': { mb: 0 },
                    }}
                  >
                    {/* Project info section */}
                    <Stack
                      direction="horizontal"
                      alignItems="center"
                      sx={{ mb: 2, gap: 2 }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        <Checkbox
                          checked={
                            selectedItems instanceof Set &&
                            selectedItems.has(item.event_id || item.id)
                          }
                          onChange={() =>
                            toggleItemSelection(item.event_id || item.id)
                          }
                        />
                      </Box>
                      <Avatar
                        src={item.user.avatar_url}
                        alt={`${item.user.login}'s avatar`}
                        size={24}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          // Add user to search text in format user:{username}
                          const userSearchTerm = `user:${item.user.login}`;
                          const currentSearch = searchText.trim();
                          
                          // Check if this user is already in the search text
                          const userRegex = new RegExp(`\\buser:${item.user.login.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`);
                          if (!userRegex.test(currentSearch)) {
                            const newSearchText = currentSearch 
                              ? `${currentSearch} ${userSearchTerm}`
                              : userSearchTerm;
                            setSearchText(newSearchText);
                          }
                        }}
                      />
                      <Link
                        href={item.user.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          fontSize: 1,
                          color: 'fg.muted',
                          textDecoration: 'none',
                          ':hover': { textDecoration: 'underline' },
                        }}
                      >
                        {item.user.login}
                      </Link>
                      {item.repository_url && (
                        <>
                          <Text sx={{ color: 'fg.muted' }}>/</Text>
                          <Link
                            href={`https://github.com/${item.repository_url.replace('https://api.github.com/repos/', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ fontSize: 1, color: 'accent.fg' }}
                          >
                            {
                              item.repository_url
                                .replace('https://api.github.com/repos/', '')
                                .split('/')[1]
                            }
                          </Link>
                        </>
                      )}
                    </Stack>
                    <Link
                      href={item.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'block', mb: 1 }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
                      >
                        {item.pull_request ? (
                          item.pull_request.merged_at || item.merged ? (
                            <Box
                              as="span"
                              aria-label="Merged Pull Request"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'done.fg',
                              }}
                            >
                              <GitMergeIcon size={16} />
                            </Box>
                          ) : item.state === 'closed' ? (
                            <Box
                              as="span"
                              aria-label="Closed Pull Request"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'closed.fg',
                              }}
                            >
                              <GitPullRequestIcon size={16} />
                            </Box>
                          ) : (
                            <Box
                              as="span"
                              aria-label="Open Pull Request"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                color: 'open.fg',
                              }}
                            >
                              <GitPullRequestIcon size={16} />
                            </Box>
                          )
                        ) : (
                          <Box
                            as="span"
                            aria-label={`${item.state === 'closed' ? 'Closed' : 'Open'} Issue`}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color:
                                item.state === 'closed'
                                  ? 'closed.fg'
                                  : 'open.fg',
                            }}
                          >
                            <IssueOpenedIcon size={16} />
                            {item.state === 'closed' && (
                              <Box sx={{ display: 'inline-flex', ml: '-4px' }}>
                                <XIcon size={12} />
                              </Box>
                            )}
                          </Box>
                        )}
                        <Text
                          sx={{
                            fontWeight: 'semibold',
                            fontSize: 2,
                            color: 'accent.fg',
                          }}
                        >
                          {item.title}
                        </Text>
                      </Box>
                    </Link>
                    <Stack
                      direction="horizontal"
                      alignItems="center"
                      sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}
                    >
                      {/* Display labels */}
                      {item.labels &&
                        item.labels.map(
                          (l: {
                            name: string;
                            color?: string;
                            description?: string;
                          }) => (
                            <Label
                              key={l.name}
                              sx={{
                                backgroundColor: l.color
                                  ? `#${l.color}`
                                  : undefined,
                                color: l.color
                                  ? getContrastColor(l.color)
                                  : undefined,
                                fontWeight: 'bold',
                                fontSize: 0,
                                cursor: 'pointer',
                              }}
                              title={l.description || l.name}
                              onClick={() => {
                                // Add label to search text in format label:{labelName}
                                const labelSearchTerm = `label:${l.name}`;
                                const currentSearch = searchText.trim();
                                
                                // Check if this label is already in the search text
                                const labelRegex = new RegExp(`\\blabel:${l.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`);
                                if (!labelRegex.test(currentSearch)) {
                                  const newSearchText = currentSearch 
                                    ? `${currentSearch} ${labelSearchTerm}`
                                    : labelSearchTerm;
                                  setSearchText(newSearchText);
                                }
                              }}
                            >
                              {l.name}
                            </Label>
                          )
                        )}
                    </Stack>
                    <Stack
                      direction="horizontal"
                      alignItems="center"
                      sx={{
                        fontSize: 0,
                        color: 'fg.muted',
                        mt: 2,
                        flexWrap: 'wrap',
                        gap: 3,
                      }}
                    >
                      <Stack
                        direction="horizontal"
                        sx={{ flexWrap: 'wrap', gap: 2 }}
                      >
                        <Text>
                          Created:{' '}
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                        <Text>
                          Updated:{' '}
                          {new Date(item.updated_at).toLocaleDateString()}
                        </Text>
                        {item.pull_request?.merged_at && (
                          <Text sx={{ color: 'done.fg', fontWeight: 'bold' }}>
                            Merged:{' '}
                            {new Date(
                              item.pull_request.merged_at
                            ).toLocaleDateString()}
                          </Text>
                        )}
                        {item.state === 'closed' &&
                          !item.pull_request?.merged_at && (
                            <Text sx={{ color: 'danger.fg' }}>
                              Closed:{' '}
                              {new Date(item.closed_at!).toLocaleDateString()}
                            </Text>
                          )}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            );
          })()}
        </Box>
      </ResultsContainer>

      {/* Description Dialog */}
      {selectedItemForDialog && (
        <DescriptionDialog
          item={selectedItemForDialog}
          onClose={() => setSelectedItemForDialog(null)}
          onPrevious={handlePreviousItem}
          onNext={handleNextItem}
          hasPrevious={getCurrentItemIndex() > 0}
          hasNext={getCurrentItemIndex() < filteredResults.length - 1}
        />
      )}
    </Box>
  );
});

export default ResultsList;
