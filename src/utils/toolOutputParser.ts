import type { LiveToolCall, ParsedToolOutput, GitOperationType } from '../types';
import { parseEditDiff, getFileExtension } from './diffParser';

/**
 * Git command detection patterns
 */
const gitPatterns = {
  commit: /git\s+commit\s+(?:-[am]\s+)?(?:["'](.+?)["']|(\S+))?/i,
  checkout: /git\s+checkout\s+(-b\s+)?(\S+)/i,
  push: /git\s+push\s*(\S+)?\s*(\S+)?/i,
  pull: /git\s+pull\s*(\S+)?\s*(\S+)?/i,
  merge: /git\s+merge\s+(\S+)/i,
  branch: /git\s+branch\s+(-[dD])?\s*(\S+)?/i,
  status: /git\s+status/i,
  diff: /git\s+diff/i,
  log: /git\s+log/i,
};

/**
 * Check if a bash command is git-related
 */
export function isGitCommand(command: string): boolean {
  return command.trim().startsWith('git ') || command.includes('&& git ') || command.includes('; git ');
}

/**
 * Detect the type of git operation from a command
 */
export function detectGitOperation(command: string): GitOperationType {
  if (gitPatterns.commit.test(command)) return 'commit';
  if (gitPatterns.checkout.test(command)) {
    return command.includes('-b') ? 'branch-create' : 'checkout';
  }
  if (gitPatterns.push.test(command)) return 'push';
  if (gitPatterns.pull.test(command)) return 'pull';
  if (gitPatterns.merge.test(command)) return 'merge';
  if (gitPatterns.status.test(command)) return 'status';
  if (gitPatterns.diff.test(command)) return 'diff';
  if (gitPatterns.log.test(command)) return 'log';
  if (gitPatterns.branch.test(command)) return 'branch-create';
  return 'other';
}

/**
 * Parse git commit output to extract hash and stats
 */
function parseGitCommitOutput(output: string): { hash?: string; message?: string; filesChanged?: number; additions?: number; deletions?: number } {
  const result: { hash?: string; message?: string; filesChanged?: number; additions?: number; deletions?: number } = {};

  // Match commit hash: [main abc1234] or [feature/branch abc1234]
  const hashMatch = output.match(/\[[\w/-]+\s+([a-f0-9]{7,40})\]/i);
  if (hashMatch) {
    result.hash = hashMatch[1];
  }

  // Match stats: X files changed, Y insertions(+), Z deletions(-)
  const statsMatch = output.match(/(\d+)\s+files?\s+changed(?:,\s*(\d+)\s+insertions?\(\+\))?(?:,\s*(\d+)\s+deletions?\(-\))?/i);
  if (statsMatch) {
    result.filesChanged = parseInt(statsMatch[1], 10);
    result.additions = statsMatch[2] ? parseInt(statsMatch[2], 10) : 0;
    result.deletions = statsMatch[3] ? parseInt(statsMatch[3], 10) : 0;
  }

  return result;
}

/**
 * Parse git branch creation output
 */
function parseGitBranchOutput(command: string, output: string): { branchName?: string; baseBranch?: string } {
  const result: { branchName?: string; baseBranch?: string } = {};

  // Extract branch name from command: git checkout -b branch-name
  const checkoutMatch = command.match(/checkout\s+-b\s+(\S+)/i);
  if (checkoutMatch) {
    result.branchName = checkoutMatch[1];
  }

  // Extract branch name from command: git branch branch-name
  const branchMatch = command.match(/git\s+branch\s+(\S+)/i);
  if (branchMatch && !branchMatch[1].startsWith('-')) {
    result.branchName = branchMatch[1];
  }

  // Try to extract from output: Switched to a new branch 'branch-name'
  const switchedMatch = output.match(/Switched to (?:a )?(?:new )?branch ['"]?([^'"]+)['"]?/i);
  if (switchedMatch) {
    result.branchName = switchedMatch[1];
  }

  return result;
}

/**
 * Parse git push output
 */
function parseGitPushOutput(output: string): { branchName?: string; remote?: string } {
  const result: { branchName?: string; remote?: string } = {};

  // Match: remote -> branch
  const pushMatch = output.match(/(\S+)\s+->\s+(\S+)/);
  if (pushMatch) {
    result.branchName = pushMatch[2];
  }

  return result;
}

/**
 * Parse file operation output (Read/Write/Edit)
 */
function parseFileOperation(tool: LiveToolCall): ParsedToolOutput {
  const filePath = tool.input?.file_path as string || '';
  const output = tool.output || '';

  const result: ParsedToolOutput = {
    type: 'file',
    raw: output,
    filePath,
    fileExtension: getFileExtension(filePath),
  };

  if (tool.name === 'Read') {
    // Count lines in output
    const lines = output.split('\n');
    result.lineCount = lines.length;
  } else if (tool.name === 'Write') {
    // Count lines in content being written
    const content = tool.input?.content as string || '';
    result.lineCount = content.split('\n').length;
  } else if (tool.name === 'Edit') {
    // Parse the edit diff
    const oldString = tool.input?.old_string as string || '';
    const newString = tool.input?.new_string as string || '';
    if (oldString || newString) {
      result.diff = parseEditDiff(oldString, newString);
      result.additions = result.diff.totalAdditions;
      result.deletions = result.diff.totalDeletions;
    }
  }

  return result;
}

/**
 * Parse git operation output from Bash command
 */
function parseGitOperation(tool: LiveToolCall): ParsedToolOutput {
  const command = tool.input?.command as string || '';
  const output = tool.output || '';
  const gitOp = detectGitOperation(command);

  const result: ParsedToolOutput = {
    type: 'git',
    raw: output,
    gitOperation: gitOp,
    gitCommand: command,
  };

  switch (gitOp) {
    case 'commit': {
      const commitInfo = parseGitCommitOutput(output);
      result.commitHash = commitInfo.hash;
      result.filesChanged = commitInfo.filesChanged;
      result.additions = commitInfo.additions;
      result.deletions = commitInfo.deletions;
      // Try to extract commit message from command
      const msgMatch = command.match(/-m\s+["'](.+?)["']/);
      if (msgMatch) {
        result.commitMessage = msgMatch[1];
      }
      break;
    }
    case 'branch-create':
    case 'checkout': {
      const branchInfo = parseGitBranchOutput(command, output);
      result.branchName = branchInfo.branchName;
      break;
    }
    case 'push': {
      const pushInfo = parseGitPushOutput(output);
      result.branchName = pushInfo.branchName;
      break;
    }
  }

  return result;
}

/**
 * Parse search operation output (Glob/Grep)
 */
function parseSearchOperation(tool: LiveToolCall): ParsedToolOutput {
  const output = tool.output || '';
  const lines = output.split('\n').filter(l => l.trim());

  const result: ParsedToolOutput = {
    type: 'search',
    raw: output,
    fileMatches: lines.length,
  };

  // For Grep, try to count matches
  if (tool.name === 'Grep') {
    result.matchCount = lines.length;
  }

  return result;
}

/**
 * Parse Task tool output for progress indicators
 */
function parseTaskOutput(tool: LiveToolCall): ParsedToolOutput {
  const output = tool.output || '';

  const result: ParsedToolOutput = {
    type: 'task',
    raw: output,
  };

  // Look for todo/task progress patterns
  const todoMatch = output.match(/(\d+)\s*(?:of|\/)\s*(\d+)\s*(?:tasks?|items?|todos?)/i);
  if (todoMatch) {
    result.taskProgress = {
      completed: parseInt(todoMatch[1], 10),
      total: parseInt(todoMatch[2], 10),
    };
  }

  // Count nested tool call mentions
  const toolMentions = (output.match(/(?:Read|Write|Edit|Bash|Glob|Grep|Task|WebFetch)\s+/gi) || []).length;
  if (toolMentions > 0) {
    result.nestedToolCount = toolMentions;
  }

  return result;
}

/**
 * Parse Bash command output (non-git)
 */
function parseBashOutput(tool: LiveToolCall): ParsedToolOutput {
  const command = tool.input?.command as string || '';
  const output = tool.output || '';

  return {
    type: 'bash',
    raw: output,
    gitCommand: command, // Reusing gitCommand field for bash command
  };
}

/**
 * Main router function - parse tool output based on tool type
 */
export function parseToolOutput(tool: LiveToolCall): ParsedToolOutput {
  // File operations
  if (tool.name === 'Read' || tool.name === 'Write' || tool.name === 'Edit') {
    return parseFileOperation(tool);
  }

  // Bash - check if it's git or regular bash
  if (tool.name === 'Bash') {
    const command = tool.input?.command as string || '';
    if (isGitCommand(command)) {
      return parseGitOperation(tool);
    }
    return parseBashOutput(tool);
  }

  // Search operations
  if (tool.name === 'Glob' || tool.name === 'Grep') {
    return parseSearchOperation(tool);
  }

  // Task tool
  if (tool.name === 'Task') {
    return parseTaskOutput(tool);
  }

  // Unknown/other tools
  return {
    type: 'unknown',
    raw: tool.output || '',
  };
}
