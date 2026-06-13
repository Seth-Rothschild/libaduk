<script>
  import { onMount } from 'svelte';

  let stats = $state(null);

  onMount(async () => {
    const response = await fetch('/api/stats');
    stats = await response.json();
  });
</script>

<main class="page-small box box-pad">
  <h1 class="box__top">Frequently Asked Questions</h1>

  <h2>Libaduk</h2>

  <details class="question" name="faq">
    <summary><span>Why is Libaduk called Libaduk?</span></summary>
    <div class="answer">
      <p>
        Libaduk is heavily inspired by and uses code from <a href="https://lichess.org"
          >Lichess.org</a
        >, a very nicely designed website for chess. Similar to Lichess, the name is a combination
        of "li" from libre and "baduk", the Korean word for Go. Libaduk is free both in terms of
        software (<a href="https://en.wikipedia.org/wiki/GNU_Affero_General_Public_License">AGPL</a>
        licensed frontend and backend) and money. You can find the open source code on
        <a href="https://github.com/Seth-Rothschild/libaduk">GitHub</a>.
      </p>
    </div>
  </details>

  <details class="question" name="faq">
    <summary><span>How can I contribute to Libaduk?</span></summary>
    <div class="answer">
      <p>
        I don't want your money. If you'd like to donate to a project, consider contributing to <a
          href="https://lichess.org/patron">Lichess</a
        >
        or
        <a href="https://online-go.com/supporter">OGS</a> without which this work would not be nearly
        as good. At the current cost of operating the site, I'll be able to run it out-of-pocket for a
        long time.
      </p>
      <p>
        The most helpful thing you can do for Libaduk is to tell me about where the user experience
        is bad or could be better. You can ping me in the <a href="/tv">chat</a> room, or write an
        <a href="https://github.com/Seth-Rothschild/libaduk/issues">issue</a> on GitHub. My objective
        here is to have a delightful place to play and study Go, and it is very helpful for people to
        tell me about things that aren't delightful yet!
      </p>
    </div>
  </details>

  <details class="question" name="faq">
    <summary><span>Do we really need yet another Go website?</span></summary>
    <div class="answer">
      <p>
        Nope! The community of players that plays go online is small and does not need to be split.
      </p>
      <p>
        I do not want to create a replacement for any of the large servers or to have explosive user
        growth. If you're looking for a western site with a large user base, you're probably looking
        for <a href="https://online-go.com/">OGS</a>. You can use that OGS account for some quick
        play functionality here, but I have no plans to implement a ranking system or recruit large
        groups of users over to this site.
      </p>
      <p>
        While I would like for OGS to have a better user interface, This site, by virtue of having
        fewer users, will always be able to move faster and be more experimental than OGS. I've
        already contributed some minor UX adjustments to the open source frontend of OGS and if
        there are other things you'd like to see here or there just let me know.
      </p>
    </div>
  </details>

  <details class="question" name="faq">
    <summary><span>Do I need an account to use Libaduk?</span></summary>
    <div class="answer">
      <p>
        Mostly not! The majority of the site will work just fine whether or not you have an account.
        You can <a href="/?setup=hook">create games</a>, collaborate with others in the
        <a href="/library">library</a>, or do <a href="/puzzle/daily">puzzles</a> all without an account.
        There are two exceptions to this:
      </p>
      <ol>
        <li>
          You'll have an easier time finding games with real people by connecting an <a
            href="/account/preferences/ogs">OGS account</a
          > which requires connecting that account to a user on this site. If you already have an OGS
          account, you can just use that to create a user here.
        </li>
        <li>
          For correspondence games it would be wise to create a real account. The site tries to give
          you a consistent Guest ID, but if that ID changes for any reason you'll lose the ability
          to play moves in your own game.
        </li>
      </ol>
    </div>
  </details>

  <h2>AI</h2>

  <details class="question" name="faq">
    <summary><span>Is this site vibe coded?</span></summary>
    <div class="answer">
      <p>
        This site has made use of LLMs to get it where it is, but I don't think it would be
        considered vibe coded by most definitions.
      </p>
      <p>
        The initial pass of this site mostly consisted of pointing Claude at code from <a
          href="https://github.com/lichess-org/lila">lila</a
        >
        to grab the page HTML and CSS and
        <a href="https://github.com/SabakiHQ/Sabaki/tree/master">Sabaki</a> to grab Go board design and
        implementation. This has created an absurd amount of tech debt, which might or might not have
        been worthwhile. While the code isn't to the quality where I would personally like it, this approach
        got me to a working Go site that looks like Lichess, which I've tried to do a few times in the
        past without success.
      </p>
      <p>
        The use of LLMs to write code is currently polarizing. If it's unacceptable for you to use
        any site that an LLM has written code for then this site will not pass your bar. But I do
        write code professionally, I have written other <a
          href="https://github.com/Seth-Rothschild/goban_irl">open source code</a
        > for the Go community in the past, I have read all the code, and I review all new code going
        in.
      </p>
    </div>
  </details>

  <details class="question" name="faq">
    <summary><span>Can I use AI to review my games here?</span></summary>
    <div class="answer">
      <p>
        Maybe eventually, but not yet! Right now, you can only <a href="/?setup=ai"
          >play games against AI</a
        >. But for review, I'm focused on improving the human and collaborative experience of game
        review. While AI can help find "more correct" moves, it provides a negative pressure against
        wanting to review with others so any future implementation will have to be thoughtful and
        careful.
      </p>
    </div>
  </details>

  <h2>Finding games</h2>

  <details class="question" name="faq">
    <summary><span>Why can't I find a game on Libaduk?</span></summary>
    <div class="answer">
      <p>
        While there are <a href="/player">{stats?.totalPlayers} registered users</a>, there
        typically are only a couple of users online at any given time. There are a few alternatives:
      </p>
      <ol>
        <li>
          If you <a href="/account/preferences/ogs">connect an OGS account</a>, the quick play games
          generate unranked games on OGS and you can see other unranked games posted in Lobby. This
          is the best way to get a live game against another human.
        </li>
        <li>
          If you create a game, you can send that link to a friend and play even if they don't have
          an account.
        </li>
        <li>
          The site supports correspondence games where each player has some number of days to make a
          move. You can join an existing challenge or create a new one!
        </li>
        <li>You can <a href="/?setup=ai">play against an AI</a> on this site!</li>
      </ol>
    </div>
  </details>

  <details class="question" name="faq">
    <summary><span>How does the OGS connection work?</span></summary>
    <div class="answer">
      <p>
        The connection uses the oauth flow as set up by OGS. Libaduk redirects you to OGS who asks
        for your approval, and they redirect back to us with a code we can use to generate a token
        for you.
      </p>
      <p>
        That token can act as you to do things with the OGS API, which Libaduk uses for creating and
        joining games as you. The token is <em>mostly</em> stored in your browser but it does get used
        serverside in a few flows. I've tried to limit any storage of "secrets" on this site and hope
        to limit it even further.
      </p>
    </div>
  </details>
</main>

<style>
  h1.box__top {
    padding: 0 0 4vh 0;
    font-size: 28px;
    font-weight: 300;
  }

  h2 {
    margin-bottom: 0.3em;
    font-size: 1.8em;
    font-weight: 300;
  }

  details.question {
    border-radius: 3px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-zebra);
    padding: 1em 2em;
    margin-top: 1em;
  }

  details.question + h2 {
    margin-top: 1.3em;
  }

  details.question summary {
    font-size: 1.3em;
    padding-top: 0;
    cursor: pointer;
    font-weight: bold;
  }

  details.question summary::marker {
    color: var(--c-font-dim);
  }

  details.question summary span {
    margin-left: 0.25em;
  }

  details.question:open summary,
  details.question:open summary::marker {
    color: var(--c-accent);
  }

  .answer {
    padding-top: 0.5em;
  }

  .answer em {
    font-style: italic;
  }

  .answer *:last-child {
    margin-bottom: 0.25em;
  }

  .answer ol {
    list-style: decimal;
    padding-left: 1.5em;
  }

  .answer ol li {
    display: list-item;
    list-style-type: decimal;
    margin-top: 0.4em;
  }
</style>
