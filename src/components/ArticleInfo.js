import React from 'react';

export const ArticleInfo = ({ author, authorLink, published, views, comments, collects }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--ifm-color-emphasis-100)',
        borderRadius: 'var(--ifm-pre-border-radius)',
        padding: '1rem',
        marginBottom: '1rem',
        fontSize: '0.9rem',
        color: 'var(--ifm-color-emphasis-700)',
      }}
    >
      <div>
        <strong>Author:</strong>{' '}
        <a href={authorLink} target="_blank" rel="noopener noreferrer">
          {author}
        </a>
      </div>
      <div>
        <strong>Published:</strong> {published}
      </div>
      <div>
        <strong>Stats:</strong> 👁️ {views} views | 💬 {comments} comments | ⭐ {collects} collects
      </div>
    </div>
  );
};