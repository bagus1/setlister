




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
			\fill-line { \larger "Orchids In The Moonlight" }
			\fill-line {
				"Lyrics by Gus Kahn, Edward Eliscu"
				"Music by Vincent Youmans"
			}
			\fill-line {
				"With a Tango Beat"
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
	f1:m | des2 f1.:m | c1:7 | \myEndLine
	c:7 | g2:m7.5- c1.:7 | f1:m | \myEndLine
	f:m | des2 f:m | f1:7 | bes:m | \myEndLine
	bes:m | f1:m | c:7 | f4:m c:7 f2:m | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	f2 f4:dim c:7 | f1. f2:6 | c1:7 | \myEndLine
	c1*3:7 | f2. fis4:dim | \myEndLine
	c2:7 f4:dim c:7 | f1. f2:7 | bes1 | \myEndLine
	bes | des:7 | f2 f4:dim c:7 | f4 c:7 f2 | \myEndLine
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
	\tempo "Moderato" 4 = 108
	\time 4/4
	\key f \minor

	% part "A"
	r8 f f g aes4 g8 f | des'2 c~ | c8 c c des ees4 des8 c | e!1 |
	r8 bes bes c des4 c8 bes | f'2 e!2~ | e8 c c des ees!4 des8 c | f1 |
	r8 f, f g aes4 g8 f | des'2 c~ | c8 c c des ees4 des8 c | f1 |
	r8 des ees f~ f ees des bes | r c des ees~ ees des c aes | r bes c des~ des bes g e! | f4 r r2^\markup { \italic { Fine } } |

	% part "B"
	\key f \major
	r4 c8 a' aes4 bes,8 g' | f2 c~ | c4 f8 a c4. c8 | c1 |
	r4 bes8 a bes c4 bes8 | a4 gis8 g gis a4 gis8 | g!4 fis8 f fis g4 e8 | c2. r4 |
	r c8 a' aes4 bes,8 g' | f2 c~ | c8 f a c f4. f8 | f1 |
	r4 d8 cis d e4 d8 | des4 des8 c des ees4 des8 | c4 c,8 a' aes4 bes,8 g' | f2. r4^\markup { \italic { D.C. al Fine } } |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {

	% part "A"
	When or -- chids bloom in the moon -- light __ and lov -- ers vow to be true;
	I still can dream in the moon -- light, __ of one dear night that we knew.
	When or -- chids fade in the dawn -- ing, __ they speak of tears and "\"Good" -- "bye!\""
	Tho' my dreams __ are shat -- tered, like the pet -- als scat -- tered, still my love __ can nev -- er die.

	% part "B"
	There is peace in the twi -- light, __ when the day is thru,
	but the shad -- own that fall on -- ly seem to re -- call all my long -- ing for you.
	There's a dream in the moon -- beams, __ up on the sea of blue;
	but the moon -- beams that fall, on -- ly seem to re -- call, love is all, love is you.
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
	f1:m | des2 f1.:m | c1:7 | \myEndLine
	c:7 | g2:m7.5- c1.:7 | f1:m | \myEndLine
	f:m | des2 f:m | f1:7 | bes:m | \myEndLine
	bes:m | f1:m | c:7 | f4:m c:7 f2:m | \myEndLine
	\endPart

	\myMark "B"
	\startPart
	f2 f4:dim c:7 | f1. f2:6 | c1:7 | \myEndLine
	c1*3:7 | f2. fis4:dim | \myEndLine
	c2:7 f4:dim c:7 | f1. f2:7 | bes1 | \myEndLine
	bes | des:7 | f2 f4:dim c:7 | f4 c:7 f2 | \myEndLine
	\endPart

	\endSong
	\endChords
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Moderato" 4 = 108
	\time 4/4
	\key f \minor

	% part "A"
	r8 f f g aes4 g8 f | des'2 c~ | c8 c c des ees4 des8 c | e!1 |
	r8 bes bes c des4 c8 bes | f'2 e!2~ | e8 c c des ees!4 des8 c | f1 |
	r8 f, f g aes4 g8 f | des'2 c~ | c8 c c des ees4 des8 c | f1 |
	r8 des ees f~ f ees des bes | r c des ees~ ees des c aes | r bes c des~ des bes g e! | f4 r r2^\markup { \italic { Fine } } |

	% part "B"
	\key f \major
	r4 c8 a' aes4 bes,8 g' | f2 c~ | c4 f8 a c4. c8 | c1 |
	r4 bes8 a bes c4 bes8 | a4 gis8 g gis a4 gis8 | g!4 fis8 f fis g4 e8 | c2. r4 |
	r c8 a' aes4 bes,8 g' | f2 c~ | c8 f a c f4. f8 | f1 |
	r4 d8 cis d e4 d8 | des4 des8 c des ees4 des8 | c4 c,8 a' aes4 bes,8 g' | f2. r4^\markup { \italic { D.C. al Fine } } |
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
		\smaller \smaller { "Copyright © 1933 by T.B. Harms Co." }
	}
	\fill-line {
		\smaller \smaller { "Copyright Renewed, assigned to Chappell & Co., Inc (Intersong Music, Publisher) and T.B. Harms Co. (c/o The Welk Music Group, Santa Monica, CA 90401) for the U.S.A. only. Rights outside controlled by T.B. Harms Co." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Mark Veltzer <mark.veltzer@gmail.com>, Built at 17:52:23 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





