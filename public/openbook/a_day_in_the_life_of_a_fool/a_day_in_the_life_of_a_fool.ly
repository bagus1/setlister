




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
			\fill-line { \larger "A Day In The Life Of A Fool" }
			\fill-line { \large \smaller \bold \larger "Manha De Carnaval / Black Orpheus" }
			\fill-line {
				"Lyrics by Carl Sigman"
				"Music by Luiz Bonfa"
			}
			\fill-line {
				"Slow Bossa Nova"
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

	\partial 4 s4 |

	\myMark "A"
	\startPart
	a1:m | b2:m7.5- e:7.9- | a1:m | b2:m7.5- e:7.9- | \myEndLine
	a1:m | d2:m7 g:7 | c1:maj7 | e2:m7.5- a:7.9- | \myEndLine
	d1:m7 | g:7 | c:maj7 | f:maj7 | \myEndLine
	b:m7.5- | e:7.9- | a:m | b2:m7.5- e:7.9- | \myEndLine
	\endPart

	\myMark "A'"
	\startPart
	a1:m | b2:m7.5- e:7.9- | a1:m | b2:m7.5- e:7.9- | \myEndLine
	e1:m7.5- | a:7.9- | d1*2:m | \myEndLine
	d2:m d:m/c | b:m7.5- e:7.9- | a:m a:m/g | f1:maj7 | \myEndLine
	b:m7.5- | e:7 | a2:m d:m7 | a1:m | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	d2:m7 a:m7 | d:m7 a:m7 | d:m7 e:m7 | a1*2:m6 | \myEndLine
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
	\tempo "Moderato" 4 = 120
	\time 4/4
	\key c \major

	\partial 4 e4 |

	% part "A"
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 gis b } | e,1~ | e2 r4 e4 |
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 g b } | e,1~ | e2 r8 e f g |
	a4. d,8 d2~ | d r8 d e f | g4. c,8 c2~ | c r8 c d e |
	f4. b,8 b2~ | b \tuplet 3/2 { b4 c d } | e1~ | e2 r4 e |

	% part "A'"
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 gis b } | e,1~ | e2 r4 e4 |
	bes'2~ \tuplet 3/2 { bes4 a g } | g2~ \tuplet 3/2 { g4 f e } | a1~ | a |
	r4 d, \tuplet 3/2 { d e f } | b1 | r4 c, \tuplet 3/2 { c d e } | a2. g4 |
	e1~ | e2 \tuplet 3/2 { e4 gis b } | a1~ | a2 \tuplet 3/2 { r4 a b } |

	% part "B"
	\tuplet 3/2 { c d c } \tuplet 3/2 { b a b } | \tuplet 3/2 { c d c } \tuplet 3/2 { b a b } |
	\tuplet 3/2 { c d c } \tuplet 3/2 { b a g } | a1~ | a2. r4 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	A Day __ In The Life __ Of A Fool, __
	a sad __ and a long, __ lone -- ly day, __
	I walk the av -- e -- nue __ and hope I'll run in -- to __
	the wel -- come sight of you __ com -- ing my way. __

	% part "A'"
	I stop __ just a -- cross __ from your door __
	but you're __ nev -- er home __ an -- y -- more. __
	So back to my room and there in the gloom
	I cry __ tears of good -- bye. __

	% part "B"
	'Til you come back to me,
	that's the way it will be
	ev -- 'ry day in the life of a fool. __
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

	\partial 4 s4 |

	\myMark "A"
	\startPart
	a1:m | b2:m7.5- e:7.9- | a1:m | b2:m7.5- e:7.9- | \myEndLine
	a1:m | d2:m7 g:7 | c1:maj7 | e2:m7.5- a:7.9- | \myEndLine
	d1:m7 | g:7 | c:maj7 | f:maj7 | \myEndLine
	b:m7.5- | e:7.9- | a:m | b2:m7.5- e:7.9- | \myEndLine
	\endPart

	\myMark "A'"
	\startPart
	a1:m | b2:m7.5- e:7.9- | a1:m | b2:m7.5- e:7.9- | \myEndLine
	e1:m7.5- | a:7.9- | d1*2:m | \myEndLine
	d2:m d:m/c | b:m7.5- e:7.9- | a:m a:m/g | f1:maj7 | \myEndLine
	b:m7.5- | e:7 | a2:m d:m7 | a1:m | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	d2:m7 a:m7 | d:m7 a:m7 | d:m7 e:m7 | a1*2:m6 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Moderato" 4 = 120
	\time 4/4
	\key c \major

	\partial 4 e4 |

	% part "A"
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 gis b } | e,1~ | e2 r4 e4 |
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 g b } | e,1~ | e2 r8 e f g |
	a4. d,8 d2~ | d r8 d e f | g4. c,8 c2~ | c r8 c d e |
	f4. b,8 b2~ | b \tuplet 3/2 { b4 c d } | e1~ | e2 r4 e |

	% part "A'"
	c'2~ \tuplet 3/2 { c4 b a } | a2~ \tuplet 3/2 { a4 gis b } | e,1~ | e2 r4 e4 |
	bes'2~ \tuplet 3/2 { bes4 a g } | g2~ \tuplet 3/2 { g4 f e } | a1~ | a |
	r4 d, \tuplet 3/2 { d e f } | b1 | r4 c, \tuplet 3/2 { c d e } | a2. g4 |
	e1~ | e2 \tuplet 3/2 { e4 gis b } | a1~ | a2 \tuplet 3/2 { r4 a b } |

	% part "B"
	\tuplet 3/2 { c d c } \tuplet 3/2 { b a b } | \tuplet 3/2 { c d c } \tuplet 3/2 { b a b } |
	\tuplet 3/2 { c d c } \tuplet 3/2 { b a g } | a1~ | a2. r4 |
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
		\smaller \smaller { "Copyright © 1959 by Nouvelles Editions Meridian" }
	}
	\fill-line {
		\smaller \smaller { "1964 by Anne-Rachel Music Corp. and United Artists Music Co., Inc. Copyrights for the U.S.A. & Canada assigned to Chappell & Co., Inc. and United Artists Music Co., Inc." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:14 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





