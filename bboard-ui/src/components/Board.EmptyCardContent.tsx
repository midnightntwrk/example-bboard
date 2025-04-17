import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { CardActions, CardContent, IconButton, Typography } from '@mui/material';
import BoardAddIcon from '@mui/icons-material/PostAddOutlined';
import CreateBoardIcon from '@mui/icons-material/AddCircleOutlined';
import JoinBoardIcon from '@mui/icons-material/AddLinkOutlined';
import { TextPromptDialog } from './TextPromptDialog';

/**
 * The props required by the {@link EmptyCardContent} component.
 *
 * @internal
 */
export interface EmptyCardContentProps {
  /** A callback that will be called to create a new bulletin board. */
  onCreateBoardCallback: () => void;
  /** A callback that will be called to join an existing bulletin board. */
  onJoinBoardCallback: (contractAddress: ContractAddress) => void;
}

/**
 * Used when there is no board deployment to render a UI allowing the user to join or deploy bulletin boards.
 *
 * @internal
 */
export const EmptyCardContent: React.FC<Readonly<EmptyCardContentProps>> = ({
  onCreateBoardCallback,
  onJoinBoardCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);

  return (
    <React.Fragment>
      <CardContent>
        <Typography align="center" variant="h1" color="primary.dark">
          <BoardAddIcon fontSize="large" />
        </Typography>
        <Typography data-testid="board-posted-message" align="center" variant="body2" color="primary.dark">
          Create a new Board, or join an existing one...
        </Typography>
      </CardContent>
      <CardActions disableSpacing>
        <IconButton title="Create a new board" data-testid="board-deploy-btn" onClick={onCreateBoardCallback}>
          <CreateBoardIcon />
        </IconButton>
        <IconButton
          title="Join an existing board"
          data-testid="board-join-btn"
          onClick={() => {
            setTextPromptOpen(true);
          }}
        >
          <JoinBoardIcon />
        </IconButton>
      </CardActions>
      <TextPromptDialog
        prompt="Enter contract address"
        isOpen={textPromptOpen}
        onCancel={() => {
          setTextPromptOpen(false);
        }}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinBoardCallback(text);
        }}
      />
    </React.Fragment>
  );
};
