\version "2.24.4"

\header {
  title = "Body And Soul"
  composer = "John Green"
  style = "Jazz"
}

\score {
  \new Staff {
    \clef treble
    \time 4/4
    \key c \major
    
    % Simple chord progression placeholder
    c'4 d' e' f' |
    g' f' e' d' |
    c'2 c'2 |
    \bar "|."
  }
  \layout {}
  \midi {
    \tempo 4 = 120
  }
}