import express from "express";
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { inject } from '@vercel/analytics';

const app = express();

// Vercel Web Analytics integration
// For client-side tracking, we'll serve HTML responses with the analytics script
const getHtmlTemplate = (content) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chai & Blogs - Articles</title>
  <style>
    body {
      font-family: monospace;
      white-space: pre-wrap;
      word-wrap: break-word;
      padding: 20px;
      background-color: #1e1e1e;
      color: #d4d4d4;
    }
  </style>
</head>
<body>
${content}
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
};

marked.use(markedTerminal({
  width: 100,
  reflowText: true,
  showSectionPrefix: false,
  unescape: true,
  emoji: true,
  image: function (href, title, text) {
    return "Why image are not loaded in terminal :) " + text + "\n"
  }
}));

const ALL_POSTS_QUERY = `
  query GetAllPosts($host: String!) {
    publication(host: $host) {
      posts(first: 20) {
        edges {
          node {
            title
            slug
            publishedAt
            brief
          }
        }
      }
    }
  }
`;

async function fetchAllPosts() {
  const response = await fetch(process.env.HASHNODE_GQL_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ALL_POSTS_QUERY,
      variables: {
        host: "satpalsinhrana.hashnode.dev"
      }
    })
  });
  const json = await response.json();
  return json.data?.publication?.posts?.edges || [];
}

app.get('/', async (req, res) => {
  try {
    const posts = await fetchAllPosts();

    const cyan = '\x1B[36m';
    const green = '\x1B[32m';
    const yellow = '\x1B[33m';
    const reset = '\x1B[0m';

    let output = '\n';
    output += cyan;
    output += '        ___\n';
    output += '       ( _ )_\n';
    output += '      |  _  _|   ☕ Chai & Blogs\n';
    output += '      | |_| |\n';
    output += '       \\___/\n';
    output += reset;
    output += '\n';
    output += '='.repeat(80) + '\n';
    output += '\t'.repeat(2) + 'Articles 📃\n';
    output += '='.repeat(80) + '\n\n';
    output += `Total Articles: ${posts.length}\n\n`;
    output += '-'.repeat(80) + '\n\n';

    posts.forEach((edge, index) => {
      const post = edge.node;
      const date = new Date(post.publishedAt).toDateString();
      output += `${yellow}${index + 1}. ${post.title}${reset}\n`;
      output += `   Published: ${date}\n`;
      output += `   ${green}curl ${process.env.HOST}/${post.slug}${reset}\n\n`;
    });

    output += '-'.repeat(80) + '\n';
    output += `Blog: ${process.env.HASHNODE_FULL_URL}\n\n`;

    // Wrap response with Vercel Web Analytics
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getHtmlTemplate(`<pre>${output}</pre>`));
  } catch (error) {
    res.status(500).send(getHtmlTemplate('<pre>Error fetching articles.</pre>'));
  }
});

const POST_QUERY = `
  query GetPost($host: String!, $slug: String!) {
    publication(host: $host) {
      post(slug: $slug) {
        title
        subtitle
        publishedAt
        content {
          markdown 
        }
        tags {
          name
        }
      }
    }
  }
`;

async function fetchPost(slug) {
  const response = await fetch(process.env.HASHNODE_GQL_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: POST_QUERY,
      variables: {
        host: "satpalsinhrana.hashnode.dev",
        slug: slug
      }
    })
  });
  const json = await response.json();
  return json.data?.publication?.post;
}

app.get('/:slug', async (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const isCurl = userAgent.includes('curl');
  const { slug } = req.params;

  if (!isCurl) {
    return res.redirect(`${process.env.HASHNODE_FULL_URL}/${slug}`);
  }

  try {
    const post = await fetchPost(slug);

    if (!post) {
      return res.status(404).send(getHtmlTemplate('<pre>\nError: Article not found.\n</pre>'));
    }

    const date = new Date(post.publishedAt).toDateString();

    let output = '\n';
    output += '='.repeat(80) + '\n';
    output += post.title.toUpperCase() + '\n';
    if (post.subtitle) {
      output += post.subtitle + '\n';
    }
    output += '='.repeat(80) + '\n\n';
    output += `Published: ${date}\n`;
    output += `Tags: ${post.tags.map(t => t.name).join(', ')}\n\n`;
    output += '-'.repeat(80) + '\n\n';
    output += marked(post.content.markdown);
    output += '\n' + '-'.repeat(80) + '\n';
    output += `Read online: ${process.env.HASHNODE_FULL_URL}/${slug}\n\n`;

    // Wrap response with Vercel Web Analytics
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getHtmlTemplate(`<pre>${output}</pre>`));

  } catch (error) {
    res.status(500).send(getHtmlTemplate('<pre>Something went wrong fetching the article.</pre>'));
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server started on port`, process.env.PORT);
});