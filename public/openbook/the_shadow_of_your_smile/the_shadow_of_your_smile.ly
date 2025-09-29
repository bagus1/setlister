




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
			\fill-line { \larger "The Shadow of Your Smile" }
			\fill-line {
				"Lyrics by Paul Francis Webster"
				"Music by Johnny Mandel"
			}
			\fill-line {
				"Slow Bossa"
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
	\startChords
	\startSong

	\partial 8*5 s8 s2 |

	\myMark "A"
	\startPart
	fis1:m7 | b2:7.9 b:7.9- | e1:m7 | a:7 | \myEndLine
	a:m7 | d:7 | g:maj7| c:maj7 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	fis:m7.5- | b:7 | e1.:m7 e2:m7/d | \myEndLine
	cis1:m7.5- | fis:7 | fis:m7 | b:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	fis1:m7 | b2:7.9 b:7.9- | e1:m7 | a:7 | \myEndLine
	a:m7 | d:7 | b:m7.5- | e:7.3-.5-.9-.11-.13- | \myEndLine
	\endPart

	\myMark "C"
	\startPart
	a:m7 | c2:m7 f:7 | b1:m7 | e:7.9- | \myEndLine
	a2:7 ees:7 | a:m7 d:7.9- | g1.:6 \OPC b2:7 | \myEndLine
	\endPart

	\endSong
	\endChords
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
	\tempo "Allegro" 4 = 130
	\time 4/4
	\key g \major

	\partial 8*5 b8 e fis g b |

	% part "A"
	cis,2. fis4 | dis2. c!4 | b1~ | b4. b8 e fis g b |
	e,2. a4 | fis2. d4 | b'1~ | b2 c8 b a g |

	% part "B"
	a2. c,4 | b2. a'4 | g1~ | g2 b8 a g fis |
	g2. b,4 | ais2. g'4 | fis1~ | fis4 r8 b, e fis g b |

	% part "A"
	cis,2. fis4 | dis2. c!4 | b1~ | b4. b8 e fis g b |
	e,2. c'4 | a2. fis4 | d'1~ | d2 e8 d c b |

	% part "C"
	c4. e,8 c'2~ | c d8 c b a | b4. d,8 b'2~ | b c8 b a gis |
	a4. cis,8 a'2~ | a4. c,!8 b' a g fis | g1 | r4_\markup { \italic { Fine } } r8 b, e fis g b |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




% this version of the lyrics is from the fake book but adjusted for the real book (the real book has no lyrics).
\lyricmode {

	% part "A"
	The sha -- dow of your smile, when you are gone. __
	Will co -- lor all my dreams, and light the dawn. __

	% part "B"
	Look in -- to my eyes, my love, and see. __
	All the love -- ly things you are to me. __

	% part "A"
	A wist -- ful lit -- tle star, was far too high. __
	A tear drop kissed your lips, and so did I. __

	% part "C"
	Now when I re -- mem -- ber spring. __
	All the joy that love can bring. __
	I will be re -- mem -- be -- ring __
	The sha -- dow of your smile.

	% part "return"
	The sha -- dow of your
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
	\startChords
	\startSong

	\partial 8*5 s8 s2 |

	\myMark "A"
	\startPart
	fis1:m7 | b2:7.9 b:7.9- | e1:m7 | a:7 | \myEndLine
	a:m7 | d:7 | g:maj7| c:maj7 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	fis:m7.5- | b:7 | e1.:m7 e2:m7/d | \myEndLine
	cis1:m7.5- | fis:7 | fis:m7 | b:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	fis1:m7 | b2:7.9 b:7.9- | e1:m7 | a:7 | \myEndLine
	a:m7 | d:7 | b:m7.5- | e:7.3-.5-.9-.11-.13- | \myEndLine
	\endPart

	\myMark "C"
	\startPart
	a:m7 | c2:m7 f:7 | b1:m7 | e:7.9- | \myEndLine
	a2:7 ees:7 | a:m7 d:7.9- | g1.:6 \OPC b2:7 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 4/4
	\key g \major

	\partial 8*5 b8 e fis g b |

	% part "A"
	cis,2. fis4 | dis2. c!4 | b1~ | b4. b8 e fis g b |
	e,2. a4 | fis2. d4 | b'1~ | b2 c8 b a g |

	% part "B"
	a2. c,4 | b2. a'4 | g1~ | g2 b8 a g fis |
	g2. b,4 | ais2. g'4 | fis1~ | fis4 r8 b, e fis g b |

	% part "A"
	cis,2. fis4 | dis2. c!4 | b1~ | b4. b8 e fis g b |
	e,2. c'4 | a2. fis4 | d'1~ | d2 e8 d c b |

	% part "C"
	c4. e,8 c'2~ | c d8 c b a | b4. d,8 b'2~ | b c8 b a gis |
	a4. cis,8 a'2~ | a4. c,!8 b' a g fis | g1 | r4_\markup { \italic { Fine } } r8 b, e fis g b |
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
		\smaller \smaller { "Copyright © 1965 (Renewed 1993) MGM/EMI Miller Catalog, Inc" }
	}
	\fill-line {
		\smaller \smaller { "Used by Permission of CPP/Belwin, Inc, Miami, FL" }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:25 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





