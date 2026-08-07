<script>
  import InfoPagesNav from '$lib/nav/InfoPagesNav.svelte';
</script>

<main class="page-menu">
  <InfoPagesNav />
  <div class="page-menu__content box box-pad">
    <h1 class="box__top">About</h1>
    <div class="body expand-text">
      <p>Hi!</p>
      <p>
        Thanks for using this site! I made this site because I like the way that
        <a href="https://lichess.org">lichess.org</a> feels and wanted to study Go with a similar interface.
        Here are a few ways to get started:
      </p>
      <ul>
        <li>
          Start by saying hi in <a href="/tv">/tv</a>. That's the best place to ask questions, post
          links to games, or I suppose <em>actually talk about the actual game stream</em>.
        </li>
        <li>
          Most things on <a href="/">libaduk.com</a> are public and collaborative by default. Once you've
          created a game or uploaded a file, you can share that link with anyone to play or review, whether
          or not they have an account. My goal is to make it as easy and pleasant as possible to learn
          this game with others.
        </li>
        <li>
          If you have registered and connected an OGS account, you can play and see
          <em>only unranked</em> games from the lobby and quick play cards. There's not much in the way
          of rankings or enforcement on this site in general, please be responsible.
        </li>
      </ul>
      <p>
        Finally, if you see unpleasant user experiences (or things that would make the site more
        delightful), I'd love to hear about them and fix them. Reach out either in <a href="/tv"
          >chat</a
        >, in the
        <a href="https://online-go.com/group/16370">OGS group</a>, or open an issue in the
        <a href="https://github.com/Seth-Rothschild/libaduk/issues">open source code</a>. I'm also
        happy to make PRs against OGS if there are things you see here that you would like on that
        site as well!
      </p>
      <p>All the best,<br />Seth</p>
    </div>
  </div>
</main>

<style>
  h1.box__top {
    padding: 0 0 4vh 0;
    font-size: 38px;
  }

  ul {
    list-style-type: disc;
    padding-left: 1.5rem;
  }

  ul li {
    list-style: disc;
  }

  ul li::marker {
    color: var(--c-font);
  }

  ul {
    margin-bottom: 1.5rem;
  }

  p,
  li {
    line-height: 1.7;
  }

  em {
    font-style: italic;
  }
</style>
