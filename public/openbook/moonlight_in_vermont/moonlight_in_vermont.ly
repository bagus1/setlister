




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
			\fill-line { \larger "Moonlight in Vermont" }
			\fill-line {
				"Lyrics by John Blackburn"
				"Music by Karl Suessdorf"
			}
			\fill-line {
				"Freely"
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

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees f4:m7 bes:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees1 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	a2:m11 d:7 | g:maj7 gis:dim7 | a:m11 aes:9.11+ | g:maj7 g:6 | \myEndLine
	bes:m11 ees:7 | aes:maj7 a:dim7 | bes:m11 ees:9 | aes bes:7.5+.9- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees1 | \myEndLine
	c2:m7 f4:9 e:9 | ees1:maj9 | \myEndLine
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
	\time 2/2
	\key ees \major

	% part "A"
	c'4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |

	% part "A"
	c'4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |

	% part "B"
	d8 d d d~ d d4 d8 | d d4 d8 d d4 d8 | d d d d'~ d4 c8 d | b!1 |
	ees,8 ees ees ees~ ees ees4 ees8 | ees ees4 ees8 ees ees4 ees8 | ees ees ees ees'~ ees4 des8 ees | c2 ces |

	% part "A"
	c!4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |
	b!8 c ees g c d b! cis! | bes!1 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	Pen -- nies in a stream, fall -- ing leaves, a sy -- ca -- more, Moon -- light In Ver -- mont.

	% part "A"
	I -- cy fin -- ger -- waves, ski trails on a moun -- tain -- side, snow -- light in Ver -- mont.

	% part "B"
	Tel -- e -- graph ca -- __ bles, they sing down the high -- way and tra -- vel each bend __ in the road,
	peo -- ple who meet __ in this ro -- man -- tic set -- ting are so hyp -- no -- tized __ by the love -- ly

	% part "A"
	ev' -- ning sum -- mer breeze, warb -- ling of a mea -- dow -- lark, Moon -- light In Ver -- mont,
	you and I and Moon -- light In Ver -- mont.
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

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees f4:m7 bes:7 | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees1 | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	a2:m11 d:7 | g:maj7 gis:dim7 | a:m11 aes:9.11+ | g:maj7 g:6 | \myEndLine
	bes:m11 ees:7 | aes:maj7 a:dim7 | bes:m11 ees:9 | aes bes:7.5+.9- | \myEndLine
	\endPart

	\myMark "A"
	\startPart
	ees2:6 c:m7 | f:m7 e:7.9+ | ees:6 c:m7 | des1:9 | f2:m7 bes:7.11 | ees1 | \myEndLine
	c2:m7 f4:9 e:9 | ees1:maj9 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Allegro" 4 = 130
	\time 2/2
	\key ees \major

	% part "A"
	c'4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |

	% part "A"
	c'4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |

	% part "B"
	d8 d d d~ d d4 d8 | d d4 d8 d d4 d8 | d d d d'~ d4 c8 d | b!1 |
	ees,8 ees ees ees~ ees ees4 ees8 | ees ees4 ees8 ees ees4 ees8 | ees ees ees ees'~ ees4 des8 ees | c2 ces |

	% part "A"
	c!4 bes g f | g1 | c4 bes g4. ees8 | f g ces,2. | g'4 f ees c! | ees1 |
	b!8 c ees g c d b! cis! | bes!1 |
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
		\smaller \smaller { "Copyright © 1944-1945 by MICHAEL H GOLDSEN, INC." }
	}
	\fill-line {
		\smaller \smaller { "Renewed 1972-1973 MICHAEL H GOLDSEN, INC." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:11 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





