




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts








% this causes the variables to be defined...












% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "Lost In The Stars" }
			\fill-line { \large \smaller \bold \larger "(Form 'Lost In The Stars')" }
			\fill-line {
				"Lyrics by Maxwell Anderson"
				"Music by Kurt Weill"
			}
			\fill-line {
				"Moderately"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startSong
	\startChords

	\partial 8 s8 |

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m7 d:7.9- | \myEndLine
	g c:maj7 | g1 | g2:/b bes:dim7 | a:m7 d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m7 d:7.9- | \myEndLine
	g c:maj7 | g e:7 | a:7 d:7 | g1 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	c2:m7 f:7 | bes g:m7 | c:m7.5- f:7 | bes g:m7 | \myEndLine
	c:m7 f:7 | bes g:m7 | c:m7.5- f4:7 f:7.5+ | e:7 ees2:7 d4:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m c:m6 | \myEndLine
	g1 | c:m6 | g | c:m6 | \myEndLine
	d2:7 a4:m7 d:7 | g1 | e2:m7 ees:7 | g bes:dim7 | \myEndLine
	d:7/a a4:m7 d:7 | g1 | e2:m7 ees:7 | g bes:dim7 |
	d:7/a d:7 | g ees:7 | g1:6 |
	\endPart

	\endChords
	\endSong
}


}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Andante Moderato" 4 = 88
	\time 4/4
	\key g \major

	\partial 8 cis8 |

	% part "A"
	e4 d g cis,8 cis | e4 d8 d a'4 r8 cis, | e4 d8 d c'4 b8 c | b4 a8 gis a4 b8 c |
	d4 b8 g e d'4 c8 | c4 b b r8 d, | e4 e8 e e4 fis8 g | a2. cis,8 cis |

	% part "A"
	e4 d g8 g cis, cis | e4 d a' r8 cis,16 cis | e8 e d4 c' b8 c | b4 a8 gis a4 b8 c |
	d4 b8 g e d'4 c8 | c4 b8. ais16 b4 r8 d,16 d | e8 e e4 a4. g8 | g2. g8 g |

	% part "B"
	bes4 bes bes a8 g | f4. d8 bes4 c8 d | ees4 ees ees bes8 c | d4. d8 d4 r8 g |
	bes4 bes8 bes a4 g | f8. f16 f8 d bes4 c8 d | ees4 ees8 ees d4 cis | d2. r8 cis |

	% part "A"
	e4 d g8. g16 cis,8 cis | e4 d8. d16 a'4 r8 cis,16 cis | e4 d c'8 c b c | b4 a8 gis a4 r8 b16 c |
	d4 d8 d d4 c8 b | a4 a8 a a4. a8 | d4 cis8 d e d c b | a4. a8 a2 |
	r4 cis,8 d c'4 c | \tuplet 3/2 { c8 b ais } b2. | b16 a g8~ g4 bes8 g4. | b8. b16 a8 g e2 |
	r4 cis8 d c'4 c | \tuplet 3/2 { c8 b ais } b2. | b16 a g8~ g4 bes8 g4. | b8. b16 c8 d e2 |
	r4 cis,8 d a'4 a | \tuplet 3/2 { a8 g fis } g2.~ | g1 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {
	Be -- fore Lord God made the sea and the land, He held all the stars in the palm of His hand, and they
	ran through His fin -- gers like grains of sand, and one lit -- tle star fell a -- lone. Then the
	Lord God hunt -- ed through the wide night air for the lit -- tle dark star on the wind down _ there. And he
	stat -- ed and prom -- ised He'd take spec -- ial care so it would -- n't get lost a -- gain. Now a
	man don't mind if the stars grow dim and the clouds blow o -- ver and dark -- en him. So
	long as the Lord God's watch -- ing o -- ver them keep -- ing track how it all goes on. But
	I've been walk -- ing through the night, and the day, 'till my eyes get wear -- y and my head turn _ grey, And _
	some -- times it seems may -- be God's gone a -- way, for -- get -- ting the prom -- ise that we heard Him say,
	And we're lost out here in the stars, lit -- tle stars, big stars, blow -- ing through the night.
	And we're lost out here in the stars, lit -- tle stars, big stars, blow -- ing through the night.
	And we're lost out here in the stars. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startSong
	\startChords

	\partial 8 s8 |

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m7 d:7.9- | \myEndLine
	g c:maj7 | g1 | g2:/b bes:dim7 | a:m7 d:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m7 d:7.9- | \myEndLine
	g c:maj7 | g e:7 | a:7 d:7 | g1 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	c2:m7 f:7 | bes g:m7 | c:m7.5- f:7 | bes g:m7 | \myEndLine
	c:m7 f:7 | bes g:m7 | c:m7.5- f4:7 f:7.5+ | e:7 ees2:7 d4:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	g2 bes:dim7 | d:7/a d:7 | g e:7.5+ | a:m c:m6 | \myEndLine
	g1 | c:m6 | g | c:m6 | \myEndLine
	d2:7 a4:m7 d:7 | g1 | e2:m7 ees:7 | g bes:dim7 | \myEndLine
	d:7/a a4:m7 d:7 | g1 | e2:m7 ees:7 | g bes:dim7 |
	d:7/a d:7 | g ees:7 | g1:6 |
	\endPart

	\endChords
	\endSong
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Andante Moderato" 4 = 88
	\time 4/4
	\key g \major

	\partial 8 cis8 |

	% part "A"
	e4 d g cis,8 cis | e4 d8 d a'4 r8 cis, | e4 d8 d c'4 b8 c | b4 a8 gis a4 b8 c |
	d4 b8 g e d'4 c8 | c4 b b r8 d, | e4 e8 e e4 fis8 g | a2. cis,8 cis |

	% part "A"
	e4 d g8 g cis, cis | e4 d a' r8 cis,16 cis | e8 e d4 c' b8 c | b4 a8 gis a4 b8 c |
	d4 b8 g e d'4 c8 | c4 b8. ais16 b4 r8 d,16 d | e8 e e4 a4. g8 | g2. g8 g |

	% part "B"
	bes4 bes bes a8 g | f4. d8 bes4 c8 d | ees4 ees ees bes8 c | d4. d8 d4 r8 g |
	bes4 bes8 bes a4 g | f8. f16 f8 d bes4 c8 d | ees4 ees8 ees d4 cis | d2. r8 cis |

	% part "A"
	e4 d g8. g16 cis,8 cis | e4 d8. d16 a'4 r8 cis,16 cis | e4 d c'8 c b c | b4 a8 gis a4 r8 b16 c |
	d4 d8 d d4 c8 b | a4 a8 a a4. a8 | d4 cis8 d e d c b | a4. a8 a2 |
	r4 cis,8 d c'4 c | \tuplet 3/2 { c8 b ais } b2. | b16 a g8~ g4 bes8 g4. | b8. b16 a8 g e2 |
	r4 cis8 d c'4 c | \tuplet 3/2 { c8 b ais } b2. | b16 a g8~ g4 bes8 g4. | b8. b16 c8 d e2 |
	r4 cis,8 d a'4 a | \tuplet 3/2 { a8 g fis } g2.~ | g1 |
}


}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1946 Chappell & Co., Inc" }
	}
	\fill-line {
		\smaller \smaller { "Renewed Chappell & Co., Inc. & TRO-Hampshire House" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Jordan Eldredge <jordan@jordaneldredge.com>, Built at 17:52:19 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





