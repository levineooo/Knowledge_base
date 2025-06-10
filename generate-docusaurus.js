const { MongoClient } = require('mongodb');
const fs = require('fs-extra');
const TurndownService = require('turndown');
const path = require('path');

// --- Configuration ---
const MONGO_URI = 'mongodb://localhost:27017';
const MONGO_DB_NAME = 'woshipm';
const MONGO_COLLECTION_NAME = 'articles';

// ⭐ POINT THIS TO YOUR DOCUSaurus PROJECT'S DOCS FOLDER
const DOCUSAURUS_PROJECT_PATH = './';
const DOCS_OUTPUT_DIR = path.join(DOCUSAURUS_PROJECT_PATH, 'docs');
const SIDEBARS_FILE_PATH = path.join(DOCUSAURUS_PROJECT_PATH, 'sidebars.js');

(async () => {
    let mongoClient;

    try {
        const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        turndownService.addRule('lazy-image', {
            filter: ['img'],
            replacement: (content, node) => `![${node.alt || ''}](${node.src || ''})`,
        });

        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        const db = mongoClient.db(MONGO_DB_NAME);
        const collection = db.collection(MONGO_COLLECTION_NAME);

        console.log('Fetching all articles from MongoDB...');
        const allArticles = await collection.find({}).sort({ published_date_obj: -1 }).toArray();

        if (allArticles.length === 0) {
            console.log('No articles found. Exiting.');
            return;
        }
        console.log(`Found ${allArticles.length} total articles.`);

        // --- Prepare Output Directory ---
        await fs.emptyDir(DOCS_OUTPUT_DIR); // Clear old docs before generating new ones
        console.log(`Output directory cleaned at: ${DOCS_OUTPUT_DIR}`);

        // --- ⭐ Prepare for Sidebar Generation ---
        const sidebarItems = [];
        const articlesByCategory = allArticles.reduce((acc, article) => {
            const category = article.category || 'uncategorized';
            if (!acc[category]) acc[category] = [];
            acc[category].push(article);
            return acc;
        }, {});
        
        console.log('Generating Docusaurus content...');

        // Loop through each category to generate files and sidebar structure
        for (const categoryName in articlesByCategory) {
            const articles = articlesByCategory[categoryName];
            const categoryDir = path.join(DOCS_OUTPUT_DIR, categoryName);
            await fs.ensureDir(categoryDir); // Create a subfolder for each category

            const categorySidebarItems = [];

            for (const article of articles) {
                // The Docusaurus 'id' for the sidebar is the file path relative to the 'docs' folder
                const docId = `${categoryName}/${article._id}`;
                const filePath = path.join(categoryDir, `${article._id}.md`);
                categorySidebarItems.push(docId);

                // --- Generate Individual Article File with Docusaurus Frontmatter ---
                let markdownContent = '';
                try {
                    markdownContent = turndownService.turndown(article.article_content || '');
                } catch (err) {
                    console.warn(`Could not convert HTML for ${article._id}: ${err.message}`);
                    markdownContent = `Content could not be converted. [View Original](${article.article_link})`;
                }

                // ⭐ DOCUSaurus YAML Frontmatter
                const fileHeader = `---
id: ${article._id}
title: "${(article.article_title || 'Untitled').replace(/"/g, '\\"')}"
tags: [${(article.article_tag || '').split(',').map(t => `"${t.trim()}"`).join(', ')}]
custom_edit_url: ${article.article_link}
---
import { ArticleInfo } from '@site/src/components/ArticleInfo';

<ArticleInfo
    author="${article.article_author || 'N/A'}"
    authorLink="${article.author_Link || '#'}"
    published="${article.article_published || 'N/A'}"
    views={${article.views || 0}}
    comments={${article.comments || 0}}
    collects={${article.collects || 0}}
/>

> ${article.article_brief || 'No brief available.'}
                `.trim();

                const finalFileContent = `${fileHeader}\n\n---\n\n${markdownContent}`;
                await fs.writeFile(filePath, finalFileContent);
            }
            
            // Add the entire category to the main sidebar
            sidebarItems.push({
                type: 'category',
                label: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
                items: categorySidebarItems,
                collapsible: true,
                collapsed: true, // Start with categories collapsed for a cleaner look
            });
        }

        // --- ⭐ Generate the sidebars.js File ---
        const sidebarFileContent = `
/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation
 The sidebars can be generated from the filesystem, or explicitly defined here.
 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  // We want to explicitly define it based on our categories.
  librarySidebar: ${JSON.stringify(sidebarItems, null, 2)},
};

module.exports = sidebars;
        `;
        await fs.writeFile(SIDEBARS_FILE_PATH, sidebarFileContent);
        console.log(`Generated sidebars.js file at: ${SIDEBARS_FILE_PATH}`);

        console.log('\n✅ Docusaurus content generation complete!');
        console.log(`\nNext steps:
1. cd ${DOCUSAURUS_PROJECT_PATH}
2. npm install
3. npm run start`);

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        if (mongoClient) await mongoClient.close();
    }
})();